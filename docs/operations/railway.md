# Railway operations

## Architecture and configuration

Railway's public HTTPS web service runs Caddy, serving Vue and proxying `/api/*` to the private API service with `/api` stripped. NestJS connects to the private PostgreSQL service. Keep the API and database private; do not expose database credentials or session tokens.

Configure the API with `NODE_ENV=production`, `DATABASE_URL` (a secret), and `CORS_ORIGIN` (the exact public HTTPS origin). `PORT` is supplied by the platform when configured. Optional `AUTH_RATE_WINDOW_MS`, `AUTH_LOGIN_IP_LIMIT`, `AUTH_LOGIN_ACCOUNT_IP_LIMIT`, `AUTH_REGISTER_IP_LIMIT`, and `AUTH_REGISTER_ACCOUNT_IP_LIMIT` override the documented defaults in `apps/api/.env.example`. The web image builds with the public, non-secret `VITE_API_BASE_URL=/api`.

The limiter currently uses the socket peer, not forwarding headers. Behind Railway and Caddy, multiple clients may share an IP bucket. Confirm the actual proxy topology using a controlled test that does not log client IPs, then define and enforce trusted hops before using forwarded addresses. Do not enable unrestricted proxy trust. Counters are per API instance and reset on restart.

## Deployment and smoke checks

Use the API pre-deploy command from the API working directory:

```sh
pnpm exec prisma migrate deploy --config prisma7.config.ts
```

Confirm that the command targets the intended database before running it. The previous deployment logs reported six successful migrations; this document does not verify current Railway settings or database state. Do not use `migrate reset` against a persistent database.

A successful deployment has completed migrations and healthy web/API services. After deployment, make a few requests only:

```sh
curl -fsS -o /dev/null -w '%{http_code}\n' https://YOUR_PUBLIC_ORIGIN/
curl -fsS -o /dev/null -w '%{http_code}\n' https://YOUR_PUBLIC_ORIGIN/projects
curl -sS -o /dev/null -w '%{http_code}\n' https://YOUR_PUBLIC_ORIGIN/api/auth/me
curl -sSI https://YOUR_PUBLIC_ORIGIN/
```

Expect 200, 200, and 401 respectively. Inspect the HTML response headers for CSP, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`. In a browser, check static assets, SPA navigation, login/logout, and one disposable project/task flow. Confirm there are no CSP violations or failed API requests. Avoid printing cookies, CSRF tokens, or credentials.

`GET /api/health` checks API liveness only; it does not establish database readiness. The application's request logs contain a request ID and route template; avoid adding request bodies or secrets to edge logs.

## Recovery and cost

For a failed deployment, inspect Railway build, pre-deploy and runtime logs without exposing secrets. Restore the last known-good application deployment through Railway, verify environment settings, and repeat the smoke checks. **Application rollback does not roll back database migrations.** Verify that the old application supports the current schema before rolling back. For an incompatible migration, stop and plan a reviewed forward fix or database recovery rather than attempting an ad hoc reset.

Backups and restore capability have not been verified. Check the current plan's available backup features and costs. If backups are needed, arrange a secure backup method appropriate to the actual plan, retain credentials outside the repository, and test restoration to a separate disposable database. Never restore over production without an approved recovery plan. Do not assume that a free plan includes backups.

Before and after deployment, check Railway usage, credits, spending limits, and service status against the $0 budget. Platform pricing and limits may change; no ongoing free availability is assumed.
