# SprintDesk — Final Technical Audit Sign-off

**Audit date:** 12 November 2026. **Repository baseline:** `main` at `f8f665e`; Phase 1 `287822c` is its parent. Original report: `/Users/ntee1993/Documents/Codex/2026-11-12/referenced-chatgpt-conversation-this-is-an/outputs/SprintDesk-Technical-Audit-c1fbdc9.md`. Source working tree was clean at the start of this audit. This report is a new, untracked deliverable; no source code was changed, committed, or pushed.

## A. Executive summary

**Recommendation: READY WITH NON-BLOCKING TECHNICAL DEBT** to resume Lesson 38 in a local development/learning environment. This is not a production or public-deployment sign-off. The three original High risks are addressed for the demonstrated scenarios; pagination and concurrency have stated snapshot and coverage boundaries below. All requested regression checks and the dedicated PostgreSQL concurrency suite passed in this environment. The original pagination issue is not fully closed as a real-browser verification: the earlier browser session could not complete the >10-task checklist, and no new browser verification was performed during this audit.

## B. High finding closure

| Finding | Verdict | Evidence and boundary |
|---|---|---|
| H1: silent first-page task limit | **PARTIALLY RESOLVED** | `apps/web/src/stores/task.ts:19` requests `limit=100` repeatedly until a short page, accumulating into a local array and publishing it only after completion. `TasksView.vue:210` clears data on project switch; `tasksReady` prevents displaying partial list/summary when a later page fails. Tests in `task.spec.ts:53` and `TasksView.spec.ts:209` exercise >100 mocked tasks, search/filter/summary; the later-page-failure and stale-fetch cases are tested. Real browser verification with >10 was **not completed**. Offset pages do not represent a database snapshot under concurrent insert/delete; fetches and mutations still interact through a shared loading/error state. |
| H2: assignment versus membership removal | **RESOLVED for the tested application paths** | `tasks.service.ts:89,124` locks the Project, then validates assignee with the transaction client; `projects.service.ts:166` locks the same Project and deletes membership plus unassigns within one transaction. The real PostgreSQL tests cover removal first versus create/update assignment and a write before removal, inspecting final state. Some revocations and the forced rollback test use a test-authored transaction rather than the public service path. Direct DB writes or future paths bypassing the protocol remain outside this evidence. |
| H3: task write versus revocation | **RESOLVED for the tested application paths** | create rechecks OWNER/EDITOR after the lock, update/delete recheck predicates after the lock, and role update/removal use the same Project lock. Real PostgreSQL tests verify create after editor removal/downgrade and update/delete after downgrade; write-first creation/removal is also exercised. Unit and mocked E2E tests support ordinary role behavior; they do not prove database locking. Existing uncoordinated direct SQL or future writers would bypass the guarantee. |

The transaction order is Project row lock before membership/task mutation; update/delete first perform a non-locking task lookup to obtain the Project ID, then recheck authorization after the lock. Transactions explicitly select READ COMMITTED. Membership additions do not take this lock; their role is additive and current tested removal/downgrade cases do not require serializing them. No before-fix concurrent reproduction was performed in this audit. No exhaustive proof of deadlock freedom, fairness, or all possible interleavings is claimed.

## C. Regression results

Executed against the existing local dependencies and generated Prisma client:

| Command | Actual result |
|---|---|
| `pnpm --dir apps/api build` | Pass |
| `pnpm --dir apps/api lint` | Pass |
| `pnpm --dir apps/api test` | 55/55 pass, 10 files |
| `pnpm --dir apps/api test:e2e` | 99/99 pass, 1 file; mocked service/database providers, local socket permission required |
| `pnpm --dir apps/web exec vitest run` | 48/48 pass, 7 files |
| `pnpm --dir apps/web type-check` | Pass |
| `pnpm --dir apps/web build` | Pass |
| `DATABASE_URL=… pnpm --dir apps/api exec vitest run --config vitest.config.integration.ts test/concurrency.integration-spec.ts` | 9/9 pass against dedicated `sprintdesk_phase2_test` PostgreSQL on `127.0.0.1:55439` |

The PostgreSQL suite validates host, port, configured database name and `current_database()` before writing. This audit inspected the previously created `sprintdesk-phase2-isolated` container, started it, ran the suite, and stopped it; no development database was used. Test fixtures use unique emails and scoped cleanup. The test checks `pg_stat_activity`/`pg_blocking_pids` for waiting transactions rather than relying on a sleep. Its timing and database-observability permissions remain environment dependencies. Other PostgreSQL integration files require `sprintdesk_test` at port 5433 and were not run; they use a different guard and must not be pointed at the phase-2 container.

**Reproducibility:** No project documentation was found that supplies the phase-2 isolated database setup or Prisma generate command. The following is a reconstruction, not an existing documented workflow. It creates a disposable container and must not be run if that name or port already belongs to another service:

```bash
docker run -d --name sprintdesk-phase2-isolated \
  -e POSTGRES_USER=phase2 -e POSTGRES_PASSWORD=phase2_local \
  -e POSTGRES_DB=sprintdesk_phase2_test -p 127.0.0.1:55439:5432 postgres:16
DATABASE_URL='postgresql://phase2:phase2_local@127.0.0.1:55439/sprintdesk_phase2_test' \
  pnpm --dir apps/api exec prisma migrate deploy --config prisma7.config.ts
DATABASE_URL='postgresql://phase2:phase2_local@127.0.0.1:55439/sprintdesk_phase2_test' \
  pnpm --dir apps/api exec vitest run --config vitest.config.integration.ts test/concurrency.integration-spec.ts
docker stop sprintdesk-phase2-isolated
```

If the named container already exists, inspect its identity and port binding rather than replacing it. For a clean checkout, generate the ignored Prisma client using `DATABASE_URL='postgresql://phase2:phase2_local@127.0.0.1:55439/sprintdesk_phase2_test' pnpm --dir apps/api exec prisma generate --config prisma7.config.ts` after dependencies are installed. This command and a fresh install were not rerun in a clean checkout during this sign-off. These are local disposable credentials only.

## D. Remaining findings

| Priority / severity | Evidence, impact and recommended timing |
|---|---|
| Lesson 38–40 / Medium | **M2 state races:** `task.ts:64–108` applies mutation results without a project/session generation check; project store fetch also writes after `clearProjects()`. An old project/user result can appear in current state. Reasoned from code, not reproduced in this audit. Add delayed-response tests and invalidation. |
| Lesson 38–40 / Medium | **M3 dashboard:** `DashboardView.vue` displays whatever is currently in the task store without fetching the intended scope; can be zero or stale after login/navigation. Define overview scope and loading/error behavior. |
| Lesson 38–40 / Medium | **H1 remaining:** offset/`skip` pages can shift while records change, yielding duplicate/missing rows even when each response succeeds; full dataset is held in browser memory and rendered client-side. Move to a documented server pagination/snapshot or cursor/aggregation contract when scale or correctness requires it. |
| Lesson 38–40 / Medium | **M6 viewer UX and L3 modal error:** edit/create controls remain visible to viewers; backend remains authorization boundary. Surface errors and disable duplicate submissions in modal; test keyboard/focus and real browser behavior. |
| Before public deployment / Medium | **M4/M5 auth and configuration:** no evidenced login rate limiting; enumeration/timing signals remain. Localhost API/CORS configuration, HTTPS/cookie policy, CSRF defenses and origin validation require a deployment-specific threat model and tests. HttpOnly/SameSite are useful but not complete CSRF controls. |
| Lesson 43–46 / Medium | **Lock contention/timeouts:** writes within a project serialize; default Prisma interactive transaction timeout applies and no retry/backoff or explicit deadlock mapping is present. Consistent order reduces risk but cannot rule out all database/FK interactions. Measure contention and add bounded retries only for safe, recognized transient failures. |
| Lesson 38–46 / Medium | **M1/M7 setup and coverage:** Prisma generation and isolated DB recipe are not documented in repo; full clean-install/CI run and browser journey remain unverified. Rollback and role lifecycle coverage improved but forced rollback partly duplicates transaction operations in test code. |
| Lesson 38–46 / Low | **L1 validation:** whitespace input and `@IsOptional()` null behavior can violate non-null field expectations; `assigneeId: null` must remain valid. Verify direct HTTP errors. |
| Deferred / Low | **L2:** owner can be added as a redundant hidden member; no privilege escalation established. **L4:** frontend Task contract includes fields not mirrored in schema and lacks projectId; status/priority are DB strings. Normalize when touching contracts. |

No newly demonstrated blocker to continuing the learning roadmap was found. The state race is a real correctness risk inferred from code and should be scheduled early, not treated as proven fixed. None of these conclusions certify production readiness.

## E. Architecture and security

Vue/Pinia → HTTP → Nest guards/controllers/services → Prisma/PostgreSQL remains coherent. Session validation, owner/member read filters and OWNER/EDITOR mutation restrictions are present. Prisma transactions with project-level serialization are appropriately narrow for the current feature set. Security evaluation was source/test review, not penetration testing; SQL directly accessing tables, unreviewed future writers, production deployment topology and third-party dependency vulnerabilities were not audited. Existing login cookie uses HttpOnly and SameSite; verify CSRF, rate limits, secrets, TLS and configuration before any public exposure.

## F. Roadmap reconciliation and proposed Lessons 38–48

The original audit records the original 38–48 sequence, but no revised master roadmap was found in this repository. The table below is a **reconstructed recommendation**, not a claim that these were confirmed original lesson plans. Already implemented: Vue UI, CRUD/filter/sort, auth/session, project roles, assignment, membership management, pagination fetching, unit/mocked E2E and part of real PostgreSQL transaction/concurrency testing. Partially implemented: dashboard aggregation, browser journey, resilience/testing infrastructure. Not found as completed features: comments, optimistic updates, request logging, automated Playwright journey and preview deployment. Membership/transactions/concurrency were taught earlier than the original schedule; Lesson 37 actually covered member removal/unassignment rather than the originally planned request lifecycle/logging.

| Lesson | Objective and practical task | Concepts / deliverable | Dependencies |
|---|---|---|---|
| 38 — DI and mocking | Test real project service boundaries and repair stale state cases | DI, stubs vs integration, deferred promises; regression tests | Current stores and services |
| 39 — Component testing and comments | Implement project-scoped task comments with tests | validation, auth, FK relationships, Vue forms; API/UI/tests | 38, roles |
| 40 — Browser journeys | Exercise login, 11+ tasks, roles and comments | browser automation, isolation, assertions; repeatable end-to-end smoke suite | 39 |
| 41 — Web security | Harden login and cookie-authenticated writes | rate limits, CSRF/origin, enumeration, threat modeling; security tests | sessions and 40 |
| 42 — Performance and dashboard | Define dashboard scope and efficient task query/aggregation | profiling, indexes, pagination, query consistency; measured improvements | 38, 40 |
| 43 — Transactions and history | Record task/project activity for important changes | atomic writes, rollback, relations; activity history and DB tests | 39, 42 |
| 44 — Concurrency and optimistic UI | Implement bounded optimistic changes with rollback and stale-response protection | ordering, conflicts, retry, lock timeouts; concurrency and UI tests | 38, 43 |
| 45 — Preview deployment | Deploy an authenticated preview with safe configuration | TLS, environment validation, CORS/cookies, migrations; documented preview and smoke test | 41–44 |
| 46 — CI, request lifecycle and operations | Add CI and request logging without secrets | clean generation/build, correlation, logs, migration/backup runbook; pipeline and docs | 40, 45 |
| 47 — Integration assessment | Complete a realistic feature end-to-end and review | requirements, tests, accessibility, security review; reviewed change | 38–46 |
| 48 — Final assessment and handoff | Demonstrate application and operations | debugging, tradeoffs, documentation; demo, backlog and handoff | 47 |

## G. Prioritized action plan

1. Resume Lesson 38: test and prevent delayed mutation/project-store results across project switches and logout; document Prisma generation and isolated integration setup.
2. Complete the >10-task real-browser verification and cover dashboard scope, viewer UX and partial-failure behavior in Lessons 39–40.
3. Before preview/public use, finish the security/configuration items in Lesson 41/45 and validate real deployment behavior.
4. Address scaling, activity/history, request logging, CI and operational recovery in the proposed sequence. Record cursor/snapshot and retry decisions as volume and deployment needs become clear.

## H. Final recommendation

**READY WITH NON-BLOCKING TECHNICAL DEBT.** The fixed application paths passed both mocked regressions and coordinated real-PostgreSQL concurrency checks. The incomplete browser check, inferred frontend state races, and reproducibility/security gaps remain visible in the plan and must not be confused with production readiness.
