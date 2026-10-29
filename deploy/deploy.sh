#!/usr/bin/env bash
# Deploys GitHub's main branch on the server: pulls it, then rebuilds only what changed.
#
#   From a developer machine:  npm run deploy             (pushes main, then runs this)
#   On the server:             /opt/bueno/deploy/deploy.sh [all | frontend | backend | caddy]...
#
# With no argument the changed paths decide: frontend/ rebuilds the website, backend/ the API
# image (backend, scheduler, queue), deploy/docker-compose.yml everything, deploy/Caddyfile
# restarts Caddy. deploy/.env stays as it is (it is not in the repository).
set -euo pipefail

main() {
  cd /opt/bueno
  exec 9>/tmp/bueno-deploy.lock
  flock -n 9 || { echo "Another deploy is running."; exit 1; }

  local before after changed
  before=$(git rev-parse HEAD)
  git fetch --quiet origin main
  # The server never has its own changes: it always matches GitHub.
  git reset --hard --quiet origin/main
  after=$(git rev-parse HEAD)

  if [ "$before" != "$after" ]; then
    echo "New commits:"
    git log --oneline "$before..$after" | sed 's/^/  /'
  else
    echo "Already at $(git log -1 --oneline)."
  fi
  changed=$(git diff --name-only "$before" "$after")

  local targets=" $* "
  if [ $# -eq 0 ]; then
    grep -q '^frontend/' <<<"$changed" && targets+=" frontend "
    grep -q '^backend/' <<<"$changed" && targets+=" backend "
    grep -q '^deploy/docker-compose.yml$' <<<"$changed" && targets+=" all "
    grep -q '^deploy/Caddyfile$' <<<"$changed" && targets+=" caddy "
  fi

  cd deploy
  if [[ "$targets" == *" all "* ]]; then
    echo "Rebuilding everything..."
    docker compose up -d --build
  else
    local services=""
    [[ "$targets" == *" frontend "* ]] && services+=" frontend"
    # scheduler and queue run the API image too, so they restart with it.
    [[ "$targets" == *" backend "* ]] && services+=" backend scheduler queue"
    if [ -n "$services" ]; then
      echo "Rebuilding:$services"
      # shellcheck disable=SC2086
      docker compose up -d --build $services
    fi
  fi
  # The Caddyfile is bind-mounted and git replaces the file, so Caddy keeps the old copy until
  # it restarts (`caddy reload` does not help, 2026-10-21).
  if [[ "$targets" == *" caddy "* || "$targets" == *" all "* ]]; then
    echo "Restarting Caddy..."
    docker compose restart caddy
  fi
  if [[ "$targets" =~ ^\ *$ ]]; then
    echo "Nothing to rebuild."
    return
  fi

  # Old image layers fill the 40 GB disk otherwise.
  docker image prune -f >/dev/null

  local domain
  domain=$(grep '^DOMAIN=' .env | cut -d= -f2)
  echo -n "Waiting for https://$domain ..."
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "https://$domain/" && curl -fsS -o /dev/null "https://$domain/api/settings"; then
      echo " up."
      docker compose ps --format '  {{.Service}}: {{.Status}}'
      echo "Deployed $(git log -1 --oneline)."
      return
    fi
    echo -n "."
    sleep 2
  done
  echo
  echo "The site does not answer after 2 minutes. Logs: docker compose logs --tail=50 frontend backend"
  exit 1
}

main "$@"
