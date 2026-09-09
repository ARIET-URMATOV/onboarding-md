# Plan: Stage 1 — «Документы и доступы» (Full TZ v1.0)

## Overview
Implementation of Stage 1 «Документы и доступы» per Technical Specification v1.0 (approved 09.09.2026). 4 steps, SLA 1 week, gamification (5/5/5/10 points), hybrid verification (manual + technical).

## Current State (as of ec10070)
- Stage 1 has 5 legacy tasks: 1-docs, 1-lead, 1-mplus, 1-jira, 1-confluence (190 XP total)
- Progress stored in `progress.done_tasks` JSONB: `{"1": [...], "2": [...], "3": [...], "4": [...], "5": [...]}`
- Frontend: `Stage1Documents.tsx` renders 5 doc cards with modals
- Backend: `stages_data.py` defines FALLBACK_STAGES, `routes/progress.py` handles task toggling
- Auth: JWT cookie (`md_token`), CSRF Origin check, rate limiting
- DB: PostgreSQL with connection pool (pool_size=10, max_overflow=20, pool_pre_ping, pool_recycle=3600)
- Migrations: `entrypoint.sh` runs `alembic upgrade head` before app start

---

## Requirements Analysis

### Functional Requirements (FR)

| ID | Requirement | Step | Verification Type |
|----|-------------|------|-------------------|
| FR-01 | Sign 5 document types: Service Agreement (2 copies), NDA (2 copies), PDP (mandatory), IP Certificate, Certificate of No Criminal Record | 1 | Manual (HR) |
| FR-02 | Employee clicks "I submitted docs to HR" → status "Awaiting HR verification" | 1 | Manual (HR) |
| FR-03 | HR verifies physical documents in admin panel → awards 5 points | 1 | Manual (HR) |
| FR-04 | MBusiness access: install app, HR helps register, HR confirms in admin | 2 | Manual (HR) |
| FR-05 | Accountant access: employee follows instruction (TBD), accountant/HR confirms | 2 | Manual (Accountant/HR) |
| FR-06 | Wi-Fi: employee enters MAC address → sysadmin adds to allowlist → generates password → employee enters password for verification | 2 | Technical (password match) or Manual (sysadmin) |
| FR-07 | Proxy card/Face ID: employee requests via Lead/PM → Lead/PM confirms in admin | 2 | Manual (Lead/PM) |
| FR-08 | Telegram groups: auto-invite via bot (if API) or invite link → employee joins + greets → teamlead confirms | 2 | Technical (API) or Manual (teamlead) |
| FR-09 | Team services (Figma, Jira, Confluence): Jira/Confluence via AD groups; Figma via email invite API | 2 | Technical (API) or Manual (teamlead) |
| FR-10 | MPulse: download link → AD auth in app → select work format → check-in/out → verification code entry | 3 | Technical (code match) |
| FR-11 | MPulse verification code: same for all employees in batch (static) or dynamic via API | 3 | Technical |
| FR-12 | Confluence: clickable links to sections → 2-3 min timer → "I have read" button activates → click records timestamp + 10 pts | 4 | Technical (timer + click) |
| FR-13 | SLA: 7 calendar days from onboarding start | All | System |
| FR-14 | Overdue display: countdown timer, red warning after 7 days, manager notification | All | System |
| FR-15 | Escalation: reminder at day 6 (employee), day 7 (manager) | All | System |

### Non-Functional Requirements (NFR)

| ID | Requirement |
|----|-------------|
| NFR-01 | Persist completed task IDs in user progress (JSONB) |
| NFR-02 | XP computation includes new tasks (total 20 pts for Stage 1) |
| NFR-03 | Backward compatibility with existing 5 legacy tasks |
| NFR-04 | All API endpoints validate task IDs against known stage tasks |
| NFR-05 | HTTPS on all public endpoints |
| NFR-06 | Rate limiting on verification endpoints (brute-force protection) |
| NFR-07 | Audit logging for critical actions (login, verification, point awards) |

### Constraints

| ID | Constraint |
|----|------------|
| CON-01 | Existing task IDs (1-docs, 1-lead, 1-mplus, 1-jira, 1-confluence) must remain functional |
| CON-02 | Progress JSONB format must not break existing queries |
| CON-04 | HR verification step cannot be auto-completed by client click |
| CON-05 | HR details still being filled — some instructions are placeholders |
| CON-06 | Corporate portal JWT auto-login not yet implemented — current auth is email/password + demo |

### Actors/Clients

| Actor | Responsibilities |
|-------|------------------|
| **Employee** | Completes onboarding stages, signs documents, gets access, uses MPulse, reads Confluence |
| **HR/Administrator** | Verifies document receipt (Step 1), confirms MBusiness/accountant access, manages admin panel |
| **Sysadmin** | Manages Wi-Fi MAC allowlist, generates Wi-Fi passwords |
| **Lead/PM** | Requests proxy card/Face ID, confirms issuance |
| **Teamlead** | Confirms Telegram membership, Figma/Jira/Confluence access |
| **Accountant** | Confirms receipt of payment details |
| **System** | Persists progress, computes XP, serves API, sends notifications, enforces SLA |

### Core Use Cases

| UC | Description | Steps |
|----|-------------|-------|
| UC-01 | Document signing flow | Employee submits → HR verifies → 5 pts |
| UC-02 | Access acquisition flow | Employee completes access type → responsible person verifies → points (0 for Step 2) |
| UC-03 | MPulse flow | Install → AD auth → schedule → check-in/out → code entry → 5 pts |
| UC-04 | Confluence flow | Read sections → timer → "I have read" → 10 pts |
| UC-05 | SLA monitoring | Countdown → overdue flag → notifications |

---

## Domain Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONBOARDING PORTAL BOUNDARY                   │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│  DOCUMENT       │  ACCESS         │  MPULSE         │ CONFLUENCE│
│  SIGNING        │  ACQUISITION    │  VERIFICATION   │  READING  │
│  BOUNDARY       │  BOUNDARY       │  BOUNDARY       │  BOUNDARY │
├─────────────────┼─────────────────┼─────────────────┼───────────┤
│ • 5 doc types   │ • MBusiness     │ • AD auth       │ • Links   │
│ • HR verification│ • Accountant   │ • Schedule      │ • Timer   │
│ • 5 pts         │ • Wi-Fi (MAC)   │ • Check-in/out  │ • Confirm │
│                 │ • Proxy/Face ID │ • Code verify   │ • 10 pts  │
│                 │ • Telegram      │ • 5 pts         │           │
│                 │ • Team services │                 │           │
│                 │ • 0 pts         │                 │           │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
```

### Data Flows

#### 1. Document Signing Flow (Step 1)
```
Employee → Frontend: "I submitted docs" → API: POST /progress/toggle (task=1-dogovor|1-nda|1-pdp|1-ip|1-sn)
    → DB: done_tasks["1"] += task_id (status: pending_hr)
    → HR Admin Panel: sees pending → verifies → POST /progress/verify-docs
    → DB: marks verified → awards 5 XP
```

#### 2. Access Acquisition Flow (Step 2)
```
Employee → Frontend: completes access task → API: POST /progress/toggle (task=1-mbusiness|1-accountant|1-wifi|1-proxy|1-telegram|1-figma|1-jira|1-confluence-access)
    → DB: done_tasks["1"] += task_id (status: pending_verification)
    → Responsible person (HR/Sysadmin/Lead/Accountant/Teamlead) → Admin Panel → verifies
    → DB: marks verified (0 XP for Step 2)
```

#### 3. MPulse Flow (Step 3)
```
Employee → Frontend: downloads MPulse → AD auth in app → selects schedule → check-in/out
    → MPulse shows verification code → Employee enters code in portal
    → API: POST /progress/verify-mpulse-code {code}
    → Backend: validates code (static or API) → marks 1-mpulse-* tasks done → awards 5 XP
```

#### 4. Confluence Flow (Step 4)
```
Employee → Frontend: clicks Confluence link → timer starts (2-3 min)
    → Timer expires → "I have read" button enables
    → Employee clicks → API: POST /progress/confirm-confluence
    → Backend: records timestamp, marks 1-confluence-read + 1-confluence-confirm done → awards 10 XP
```

#### 5. SLA Monitoring Flow
```
Onboarding start → created_at stored in User
    → Frontend: computes remaining days (7 - (now - created_at))
    → If days <= 0: overdue flag + red warning
    → Background job (daily): checks overdue → sends notifications to employee + manager
```

---

## Communication Patterns

| Interaction | Pattern | Protocol |
|-------------|---------|----------|
| Employee ↔ Frontend | Synchronous | HTTPS/WS |
| Frontend ↔ Backend API | Synchronous | REST (JSON) |
| Backend ↔ PostgreSQL | Synchronous | asyncpg |
| Backend ↔ Redis | Async (Pub/Sub) | Redis protocol |
| Backend ↔ External APIs (Figma, MPulse, Telegram) | Async (HTTP) | REST |
| HR/Admin ↔ Admin Panel | Synchronous | HTTPS |
| Notifications (email/Telegram) | Async | SMTP / Bot API |

---

## Synchronous vs Asynchronous Processing

| Operation | Type | Reason |
|-----------|------|--------|
| Task toggle (employee click) | Sync | Immediate UI feedback |
| HR verification (admin action) | Sync | Immediate result in admin panel |
| MPulse code verification | Sync | Immediate feedback |
| Confluence "I have read" | Sync | Immediate XP award |
| SLA notifications | Async | Background job, non-blocking |
| External API calls (Figma invite, Telegram) | Async | Network latency, retry logic |

---

## Data Ownership & Persistence

| Data | Owner | Storage | Notes |
|------|-------|---------|-------|
| User accounts, sessions | Backend | PostgreSQL (users table) | JWT in cookie |
| Onboarding progress (done_tasks) | Backend | PostgreSQL (progress table, JSONB) | Source of truth |
| Task definitions, XP values | Backend | `stages_data.py` (code) + DB (stages table) | Reference data |
| HR verification status | Backend | PostgreSQL (progress.done_tasks + verified flags) | Extended JSONB |
| MPulse verification codes | Backend | PostgreSQL (new table or JSONB) | Static or per-batch |
| Confluence read timestamps | Backend | PostgreSQL (progress or new table) | Audit trail |
| Wi-Fi passwords | Backend | PostgreSQL (encrypted) or Redis (ephemeral) | Sysadmin sets |
| SLA timestamps (created_at) | Backend | PostgreSQL (users.created_at) | Index for queries |
| Audit logs | Backend | PostgreSQL (audit_log table) | Append-only |
| Frontend cache (doneTasks) | Frontend | Zustand store | Derived, synced from API |

---

## Failure Handling

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| PostgreSQL unavailable | API returns 503, task toggle fails | Retry with exponential backoff |
| Redis unavailable | Notifications delayed, cache misses | Fallback to DB, degrade gracefully |
| Corporate Portal unavailable | Auto-login fails, fallback to email/password | Manual login, alert ops |
| MPulse code expired/invalid | Verification fails, user re-enters | User gets new code from MPulse |
| Confluence timer bypassed | Frontend timer is UX only; backend validates timestamp | Backend enforces minimum time |
| Duplicate "I have read" click | Idempotent: check if task already done | No duplicate XP |
| HR verification delayed | Task stays pending, employee sees status | Employee can retry later |
| Wi-Fi password mismatch | Verification fails, user re-enters | Sysadmin resets password |
| Notification send failure | Log error, retry queue | Dead letter queue, alert ops |

---

## Security Architecture

### Authentication
- **Corporate Portal → Onboarding**: JWT with shared secret (5 min TTL), validated on `/auth/auto-login`
- **Onboarding Session**: Internal JWT (24h TTL) in HttpOnly Secure SameSite=None cookie (`md_token`)
- **No AD/LDAP integration** — onboarding portal trusts corporate portal JWT only

### Authorization
- **Role-based**: `employee`, `hr`, `admin`, `sysadmin`, `lead`, `teamlead`, `accountant`
- **Task-level**: Employee can only toggle own tasks; HR/Admin can verify
- **API endpoints**: Rate limited (slowapi), CSRF Origin check

### Data Protection
- **Secrets**: All in env vars (JWT_SECRET, AD_BIND_PASSWORD, SHARED_SECRET, DB_URL)
- **Wi-Fi passwords**: Encrypted at rest (AES-GCM) or stored in Redis with TTL
- **Audit logs**: Immutable, append-only, includes user_id, action, timestamp, IP

### Network
- **HTTPS**: Enforced via Vercel (frontend) + Render (backend) TLS termination
- **CORS**: Restricted to `FRONTEND_URL` env var

---

## Scalability Analysis

### Load Estimates (Current)
| Metric | Estimate |
|--------|----------|
| Concurrent employees | ~50-100 |
| API requests/sec | ~10-50 |
| WebSocket connections | N/A (polling/REST) |
| DB connections | Pool 10 + 20 overflow |
| Daily onboarding starts | ~5-10 |

### Scaling Strategy
- **Vertical**: Increase pool_size, CPU/memory on Render
- **Horizontal**: Multiple backend replicas behind load balancer (stateless)
- **DB**: Read replicas for progress queries, primary for writes
- **Redis**: Cluster mode for Pub/Sub scaling
- **Background jobs**: Separate worker processes (Celery/RQ) for notifications

### When to Decompose
- >500 concurrent users → separate auth service
- >1000 req/s → API gateway + microservices
- Complex notification workflows → dedicated notification service

---

## Observability

| Component | Metrics | Logs | Traces |
|-----------|---------|------|--------|
| API | Latency (p50/p95/p99), error rate, req/s | Structured JSON (request_id, user_id) | OpenTelemetry |
| DB | Connection pool usage, query latency, deadlocks | Slow queries (>100ms) | - |
| Redis | Memory, hit/miss rate, pub/sub lag | Connection errors | - |
| External APIs | Latency, error rate, retry count | Failed calls | - |
| Business | Stage completion rate, SLA breach count, XP distribution | Verification actions | - |

### Health Checks
- `/api/health` — liveness (returns 200)
- `/api/health/ready` — readiness (DB + Redis connectivity)

---

## Technology Selection

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | FastAPI (Python 3.12) | Async, type hints, OpenAPI, existing |
| DB | PostgreSQL 16 (asyncpg) | JSONB for flexible progress, ACID |
| ORM | SQLAlchemy 2.0 (async) | Async, type-safe |
| Migrations | Alembic | Version control, rollback |
| Cache/PubSub | Redis 7 | Ephemeral state, notifications |
| Auth | JWT (PyJWT) + bcrypt | Stateless, secure |
| Rate Limit | slowapi (Redis backend) | Distributed, sliding window |
| Frontend | React 19 + TypeScript + Vite | Modern, fast HMR |
| State | Zustand + TanStack Query | Simple global + server state |
| Styling | CSS Variables (cyberpunk theme) | No runtime overhead |
| Deploy | Docker + Render (backend) + Vercel (frontend) | Managed, auto-scaling |
| CI/CD | GitHub Actions | Lint + test + deploy |

---

## Architecture Decision Records (ADRs)

### ADR-001: Stage 1 Task Structure (confirmed 09.09.2026)
**Context**: TZ defines 4 steps with specific tasks and verification types.
**Decision**: 24 task IDs in Stage 1 (5 docs×1 + 5 access×0 + 5 MPulse×1 + 9 Confluence 8×1+read×2 = 20 XP). Legacy 1-docs/1-lead/1-mplus/1-jira/1-confluence DROPPED.
**Alternatives**: Additive (keep legacy); separate stages per step.
**Why additive rejected**: `compute_xp`/`is_all_complete` require ALL tasks → old 5/5 become 5/29, `xp_reward=150` unreachable; double semantics (1-mplus vs 1-mpulse). `normalize_tasks()` prunes legacy IDs from existing users automatically.
**Consequences**: Frontend groups by step visually; XP max recomputed 1540→1370 (Lv.16→Lv.14).

### ADR-002: Verification Mechanism per Step (confirmed 09.09.2026)
**Context**: TZ specifies manual (HR, sysadmin, lead) and technical (code, password, timer) verification.
**Decision** (simplified: employee + staff, no 6-way RBAC):
- Step 1: `POST /verify-docs {user_id, task_id}` — staff only (`require_staff`)
- Step 2: `POST /verify-access {user_id, task_id}` — staff only, 0 XP; Wi-Fi additionally `POST /wifi-mac` + `POST /wifi-verify` (WIFI_PASSWORD)
- Step 3: `POST /verify-mpulse-code {code}` — hmac vs MPULSE_VERIFICATION_CODE, marks all 5 MPulse tasks
- Step 4: `POST /confirm-confluence {opened_at}` — idempotent, min 120s enforced
**Alternatives**: Per-role gating (sysadmin/lead/accountant/teamlead user types).
**Why simplified**: all 5 manual verifiers do the same action (confirm task); responsible role shown as UI label only. `User.role` stays job-profile; new `User.is_staff` flag.
**Consequences**: One admin surface; strict per-role gating can be added later if HR asks.

### ADR-003: MPulse Verification Code
**Context**: TZ says "same code for all employees in batch" or "dynamic via API".
**Decision**: Start with static code stored in DB (configurable per onboarding batch), extensible to API.
**Alternatives**: Per-user unique codes; only API verification.
**Why**: Simplest for MVP; HR can rotate code per batch.

### ADR-004: Confluence "I Have Read" Timer (confirmed 09.09.2026: 120s)
**Context**: TZ requires 2-3 min delay before button activates. Confirmed: 2 min.
**Decision**: Frontend `setTimeout(120_000)` countdown (UX) + backend `opened_at` validation (`confluence_min_seconds=120`).
**Alternatives**: Backend-only timer (WebSocket); frontend-only (trust client).
**Why**: Frontend timer is UX; backend validation prevents bypass.

### ADR-005: Wi-Fi Password Verification
**Context**: TZ says "system compares with reference or sysadmin enters in admin".
**Decision**: Sysadmin sets password in admin panel → stored encrypted → backend compares on employee entry.
**Alternatives**: RADIUS integration; static password in env.
**Why**: No RADIUS access yet; admin panel gives control.

### ADR-006: SLA & Notifications
**Context**: TZ requires 7-day SLA, countdown, escalation at day 6/7.
**Decision**: `users.created_at` = onboarding start. Daily cron job checks overdue → sends notifications via Redis Pub/Sub → worker sends email/Telegram.
**Alternatives**: Real-time WebSocket countdown; pure frontend timer.
**Why**: Cron is reliable; frontend timer is UX only.

### ADR-007: Corporate Portal JWT Auto-login
**Context**: Authorization happens via JWT from corporate portal (shared secret), no AD/LDAP needed.
**Decision**: Implement `/auth/auto-login` endpoint that validates JWT signature and extracts user login. No AD lookup required — corporate portal guarantees user exists in AD.
**Alternatives**: Email/password login; SSO via Keycloak/AD FS.
**Why**: Simplest integration; corporate portal is source of truth for user identity.

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐  │
│  │ Employee │────▶│   Vercel     │────▶│   Render     │────▶│PostgreSQL│  │
│  │ Browser  │     │  (Frontend)  │     │  (Backend)   │     │  (Primary)│  │
│  └──────────┘     └──────────────┘     └──────┬───────┘     └──────────┘  │
│                                                │                           │
│                    ┌───────────────────────────┼───────────────────────┐   │
│                    │                           │                       │   │
│              ┌─────▼─────┐              ┌──────▼──────┐         ┌──────▼──────┐ │
│              │   Redis   │              │   AD/LDAPS  │         │  External   │ │
│              │ (Cache/   │              │  (Domain    │         │   APIs      │ │
│              │  PubSub)  │              │  Controller)│         │ (Figma,     │ │
│              └───────────┘              └─────────────┘         │  MPulse,    │ │
│                                                                    │  Telegram)  │ │
│                                                                    └─────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Environments:
- Development: Local Docker Compose (PostgreSQL, Redis, backend, frontend)
- Staging: Render Preview + Vercel Preview (branch deploys)
- Production: Render Web Service + Vercel (main branch)
```

### Environment Variables (Backend)
```bash
# Core
APP_ENV=production
DATABASE_URL=postgresql+asyncpg://...
JWT_SECRET_KEY=<32+ chars>
FRONTEND_URL=https://onboarding-mdigital.vercel.app

# Corporate Portal Auto-login (JWT validation)
SHARED_SECRET_KEY=<shared with corp portal>

# External APIs
FIGMA_API_TOKEN=<token>
MPULSE_API_URL=<url>
MPULSE_VERIFICATION_CODE=<static code or API endpoint>
TELEGRAM_BOT_TOKEN=<token>
SMTP_HOST=<host>
SMTP_PORT=587
SMTP_USER=<user>
SMTP_PASSWORD=<pass>

# Redis
REDIS_URL=redis://...
```

---

## Implementation Plan (Phased)

### Phase 1: Backend Core (Week 1)
- [ ] Extend `stages_data.py` with 24 new task IDs, XP values, verification types
- [ ] Add `verification_type` field to task definitions: `manual_hr`, `manual_sysadmin`, `manual_lead`, `manual_accountant`, `manual_teamlead`, `technical_code`, `technical_password`, `technical_timer`
- [ ] Add `responsible_role` field to tasks for admin panel routing
- [ ] Create `verify-docs`, `verify-mpulse-code`, `confirm-confluence` endpoints (stubs exist, need real logic)
- [ ] Add Wi-Fi password storage (encrypted) + verification endpoint
- [ ] Add MPulse code storage (per batch) + verification endpoint
- [ ] Add Confluence timestamp recording + idempotent confirmation
- [ ] Add `created_at` to User (already done) + SLA computation utility
- [ ] Add background job for SLA notifications (APScheduler or Celery beat)

### Phase 2: Frontend Core (Week 1-2)
- [ ] Update `data/stages.ts` with new subTasks grouped by step (4 sections)
- [ ] Redesign `Stage1Documents.tsx` → `Stage1Steps.tsx` with 4 step sections
- [ ] Step 1: Document cards with "Submitted to HR" button + status badge
- [ ] Step 2: Access cards with appropriate inputs (MAC, buttons for requests)
- [ ] Step 3: MPulse download link + code input + verification button
- [ ] Step 4: Confluence links + timer + "I have read" button
- [ ] Add SLA countdown banner (uses `user.created_at`)
- [ ] Add overdue warning + manager notification UI (admin panel)

### Phase 3: Admin Panel (Week 2)
- [ ] HR verification view: pending documents, verify button
- [ ] Sysadmin view: Wi-Fi MAC list, password management
- [ ] Lead/PM view: Proxy card requests
- [ ] Accountant view: Payment details confirmations
- [ ] Teamlead view: Telegram/Figma/Jira confirmations
- [ ] MPulse code management (set/rotate per batch)
- [ ] Audit log viewer

### Phase 4: Integrations (Week 2-3, Deferred)
- [ ] Corporate portal JWT auto-login endpoint (`/auth/auto-login`)
- [ ] Figma API invite
- [ ] Telegram bot invite
- [ ] MPulse API verification (if dynamic codes)

### Phase 5: Testing & Polish (Week 3)
- [ ] Unit tests for new endpoints
- [ ] Integration tests for verification flows
- [ ] E2E tests for 4 steps
- [ ] Load test SLA notification job
- [ ] Security review (CSRF, rate limits, secrets)

---

## Open Questions

| ID | Question | Status |
|----|----------|--------|
| OQ-01 | Step 2 points: TZ says "not specified (0)" — confirm 0 or assign? | Pending HR |
| OQ-02 | MPulse code: static per batch or dynamic API? | Pending MPulse team |
| OQ-03 | Wi-Fi password: static or per-device? | Pending Sysadmin |
| OQ-04 | Confluence timer: 2 min or 3 min? | Pending HR |
| OQ-05 | Telegram: bot API available or invite links only? | Pending DevOps |
| OQ-06 | Figma: API token available for auto-invite? | Pending Design team |
| OQ-07 | Notification channels: email only or Telegram too? | Pending HR |
| OQ-08 | Admin panel: separate app or embedded in onboarding? | Pending UX |

---

## Traceability Matrix

| TZ Section | FR/NFR | Implementation |
|------------|--------|----------------|
| 5.2 (5 docs) | FR-01, FR-02, FR-03 | Tasks: 1-dogovor, 1-nda, 1-pdp, 1-ip, 1-sn + HR verify endpoint |
| 6.1 (MBusiness) | FR-04 | Task: 1-mbusiness + HR verify |
| 6.2 (Accountant) | FR-05 | Task: 1-accountant + Accountant/HR verify |
| 6.3 (Wi-Fi) | FR-06 | Task: 1-wifi + MAC input + password verify |
| 6.4 (Proxy/Face ID) | FR-07 | Task: 1-proxy + Lead/PM verify |
| 6.5 (Telegram) | FR-08 | Task: 1-telegram + Teamlead verify |
| 6.6 (Team services) | FR-09 | Tasks: 1-figma, 1-jira, 1-confluence-access + Teamlead/API verify |
| 7.2 (MPulse) | FR-10, FR-11 | Tasks: 1-mpulse-install, 1-mpulse-schedule, 1-mpulse-checkin, 1-mpulse-code + code verify |
| 8.2 (Confluence) | FR-12 | Tasks: 1-confluence-read, 1-confluence-confirm + timer + confirm |
| 10 (SLA) | FR-13, FR-14, FR-15 | `created_at` + countdown + cron notifications |
| 11.3 (Security) | NFR-05, NFR-06, NFR-07 | HTTPS, rate limit, audit log |

---

## Mermaid Diagram Reference
See `.opencode/architecture.mmd` for:
- System context diagram (C4 Level 1)
- Container diagram (C4 Level 2)
- Component diagram (C4 Level 3) - Backend internals
- Sequence diagrams for 4 main flows
- Deployment diagram