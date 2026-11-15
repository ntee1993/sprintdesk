# Portfolio and interview notes

These notes describe a learning project developed with AI assistance. The developer directed the lessons, requirements, review, and decisions while collaborating with an AI coding assistant on implementation and verification. Explain your own role and understanding accurately in interviews; do not present AI-assisted work as independently authored.

## 30-second pitch

SprintDesk is a project-management portfolio app where people can organize projects, assign tasks, and discuss work. I used it to learn and practice full-stack development with Vue, NestJS, PostgreSQL, and Railway, including session authentication, project permissions, automated tests, and deployment operations. I developed it through guided lessons and review with AI assistance.

## Problem and contribution areas

The app gives small project teams a shared place to track work and communicate about tasks. The learning process covered feature requirements, Vue and NestJS implementation, data modeling, authentication and authorization, concurrency safeguards, test review, CI, deployment, and operational documentation.

## Challenges and decisions

- **Access and concurrency:** A role check before a write can become stale. Selected task, comment, and membership mutations acquire a project-row lock and recheck access inside a transaction. This serializes writes within one project, a trade-off for a simpler consistency boundary.
- **Cookie security:** Opaque session tokens are hashed in PostgreSQL; cookies are HttpOnly and Secure in production. Trusted-origin checks and session-bound CSRF tokens protect unsafe browser requests without exposing the session token to JavaScript.
- **Responsive UI:** Optimistic comment changes make the interface responsive. On failure, the affected change is rolled back; request generations protect against old responses after task or session changes.
- **Deployment:** A same-origin Caddy gateway serves Vue and proxies `/api` to NestJS. This avoids a separate browser API origin, while still requiring careful gateway, CSP, and cookie configuration.

## Testing, security, and lessons learned

The repository contains frontend and API unit tests, mocked HTTP E2E tests, and PostgreSQL integration tests, including concurrent membership/task cases. GitHub Actions runs these categories in isolated jobs; it is not proof of every production failure mode. The API validates inputs, checks project roles, applies authentication rate limits, and logs route templates without request bodies. Tests and review taught the importance of boundary cases, verifying real database behavior separately from mocks, and documenting operational assumptions.

## Limitations and next improvements

The rate limiter is in-memory and may see a shared proxy address. PostgreSQL backup/restore and browser CSP behavior must be checked in the actual deployment. API health is liveness only; task pages are loaded sequentially, and some lists are unpaginated. Verify the proxy boundary and recovery plan first, then measure usage before adding complexity.

## Interview questions

1. **Why store a hash of the session token?** The raw high-entropy token is held by the browser; hashing it before database storage means the stored value cannot directly serve as the cookie if the database is exposed.
2. **Why use a transaction and project lock?** A permission check alone can race with membership removal. A shared lock lets participating writes recheck access after acquiring the lock; it also serializes those writes within a project.
3. **Why use both CSRF tokens and origin checks?** Cookies are sent automatically by browsers. Exact-origin checks protect unsafe requests including login; session-bound tokens add protection for authenticated mutations. Neither is a substitute for preventing XSS.
4. **What happens when an optimistic comment update fails?** The UI restores the affected prior state and shows an error. Generation checks prevent a response from updating a different task or session.
5. **How do you validate database behavior?** Mocked E2E tests check HTTP behavior; separate integration tests use isolated PostgreSQL databases and committed migrations to test real persistence and concurrency. Production monitoring and recovery still require their own verification.
