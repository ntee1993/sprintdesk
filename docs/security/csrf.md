# CSRF and deployment configuration

Production uses a single HTTPS origin: the browser serves Vue at `/` and sends API requests to `/api`. The gateway must strip `/api` before forwarding to NestJS. Set `CORS_ORIGIN` to the exact public HTTPS origin and build the frontend with `VITE_API_BASE_URL=/api`. Production builds reject missing or different values. Configure TLS termination and redirect HTTP at the gateway; the API does not trust forwarded headers and assumes the gateway is correctly configured.

In development the frontend origin is `http://localhost:5173` and the API is `http://localhost:3000`. Every POST, PUT, PATCH and DELETE requires the configured Origin, or a Referer with that exact origin when Origin is absent. `Origin: null` and mismatches are rejected. A cross-site Fetch Metadata indication is rejected; when absent it does not replace the Origin/Referer requirement. CORS alone is not the defense.

Login and registration require a trusted origin even without a session. Other unsafe requests with a session cookie additionally require `X-CSRF-Token`. The authenticated `GET /auth/csrf` endpoint returns a no-store HMAC bound to the high-entropy session cookie, without returning the cookie. Vue obtains a token before each authenticated mutation and discards pending token responses if its session generation changes. Logout without a cookie still requires the trusted origin. Logout with a valid session requires the token. If the session is expired or revoked, the server validates that it is inactive before allowing trusted-origin logout to clear the cookie without a token; lookup failures fail closed. Session revocation and authorization remain independent checks. Non-browser clients must supply the trusted Origin or Referer and token where applicable.

The design assumes tokens and cookies are not logged by proxies, tracing, or other infrastructure. CSRF protection does not mitigate XSS or theft of the session cookie. The API does not infer client IP or HTTPS from arbitrary forwarding headers; trusted proxy and edge configuration require a separate topology decision. `SameSite=Lax` and `HttpOnly` remain unchanged, and production cookies are `Secure`.

## Deployment security decisions

API responses set nosniff, no-referrer, frame denial, and a restrictive API-only CSP. The gateway serving Vue must set a separately tested CSP for the actual frontend, HTTPS redirect, and HSTS after deployment topology is confirmed. Do not copy the API-only CSP to the Vue HTML without adapting it.

Registration deliberately retains the existing duplicate-email 409 response for clear user feedback. This allows account enumeration; rate limits reduce automated abuse but do not eliminate it. Login performs Argon2 verification for unknown and legacy accounts, reducing but not guaranteeing elimination of timing differences.

Logout revokes the current session. Revoke-all and session management remain deferred: if account recovery or password changes are introduced, revoke all sessions as part of those flows, and provide an incident response for stolen sessions.

Unexpected Nest request exceptions are logged with a server-generated request ID a fixed error category, and an allowlisted Prisma error code when available; exception text and stacks are deliberately omitted from application-controlled request exception logs. Edge, runtime, startup, process-level and dependency logging must be audited separately for sensitive data.
