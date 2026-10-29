// Deploys to production: pushes main to GitHub, then the server pulls it and rebuilds what
// changed (deploy/deploy.sh). Uncommitted changes are refused, because the server builds
// only what is on GitHub.
//
//   npm run deploy                 rebuild what the new commits changed
//   npm run deploy -- frontend     also force a part: frontend, backend, caddy or all
import { execFileSync, spawnSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") {
  console.error(`On branch "${branch}". Production deploys main: merge into main first.`);
  process.exit(1);
}
const dirty = git("status", "--porcelain");
if (dirty) {
  console.error("Uncommitted changes (the server would not get them). Commit or stash first:\n" + dirty);
  process.exit(1);
}

const targets = process.argv.slice(2);
const allowed = new Set(["all", "frontend", "backend", "caddy"]);
const unknown = targets.filter((t) => !allowed.has(t));
if (unknown.length) {
  console.error(`Unknown part: ${unknown.join(", ")}. Use frontend, backend, caddy or all.`);
  process.exit(1);
}

console.log("Pushing main to GitHub...");
const push = spawnSync("git", ["push", "origin", "main"], { stdio: "inherit" });
if (push.status !== 0) process.exit(push.status ?? 1);

console.log("Deploying on the server (a website build takes a few minutes)...");
const remote = spawnSync("ssh", ["bueno", "/opt/bueno/deploy/deploy.sh", ...targets], { stdio: "inherit" });
process.exit(remote.status ?? 1);
