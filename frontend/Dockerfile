# The website: Next.js, built once and served with `next start`.
FROM node:22-slim AS build
WORKDIR /app

# Dependencies first, so this layer is reused until package.json changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_ values are compiled into the browser code, so the API address has to be
# known at build time. Empty: the site runs on its built-in mock.
ARG NEXT_PUBLIC_API_URL=""
# Stripe's publishable key (pk_...), public by design. Empty: no card form, the site says
# a payment link will follow by email.
ARG NEXT_PUBLIC_STRIPE_KEY=""
# The Search Console ownership code (a meta tag on the home page) and the Google
# Analytics 4 measurement ID (G-...). Empty: no tag, no analytics.
ARG GOOGLE_SITE_VERIFICATION=""
ARG NEXT_PUBLIC_GA_ID=""
# The Microsoft Clarity project ID (session recordings). Empty: no Clarity.
ARG NEXT_PUBLIC_CLARITY_ID=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY \
    GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_CLARITY_ID=$NEXT_PUBLIC_CLARITY_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build


FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Owned by the unprivileged "node" user: Next writes resized images into .next/cache.
COPY --from=build --chown=node:node /app ./
USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
