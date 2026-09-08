# Plan: Stage 1 — «Документы и доступы» Improvement

## Overview
This plan implements the HR-proposed improvement for Stage 1 «Документы и доступы» (Documents and Accesses), adding 4 new verification steps with point rewards, verification mechanisms, and updated UI.

## Current State
- Stage 1 currently has 5 tasks: 1-docs, 1-lead, 1-mplus, 1-jira, 1-confluence
- Total XP: 40 + 40 + 50 + 30 + 30 = 190 XP + stage reward
- Progress stored in `progress.done_tasks` JSONB: `{"1": [...], "2": [...], "3": [...], "4": [...], "5": [...]}`
- Frontend: `Stage1Documents.tsx` renders 5 doc cards with modals
- Backend: `stages_data.py` defines FALLBACK_STAGES, `routes/progress.py` handles task toggling

## Requirements Analysis

### Functional Requirements (FR)
- **FR-01**: Step 1 — Sign 5 document types (Service Agreement, NDA, PDP, IP Certificate, Certificate of No Criminal Record)
- **FR-02**: Step 2 — Acquire access: MBusiness, accountant access, Wi-Fi (MAC), proxy/Face ID, Telegram groups, team services (Figma/Jira)
- **FR-03**: Step 3 — MPulse corporate app: AD auth, work schedule selection, daily check-in/out, verification code entry
- **FR-04**: Step 4 — Confluence knowledge base: vacation rules, grading system, company info, "I have read" confirmation
- **FR-05**: Protection against automatic passage — Step 1 requires HR/administrator verification of physical documents
- **FR-06**: Protection against scrolling for each step — technical check or responsible person confirmation required
- **FR-07**: Points distribution: Step 1 = 5 pts, Step 2 = 5 pts, Step 3 = 5 pts, Step 4 = 10 pts

### Non-Functional Requirements (NFR)
- **NFR-01**: System must persist completed task IDs in user progress
- **NFR-02**: XP computation must include new tasks
- **NFR-03**: Backward compatibility with existing 5 tasks preserved
- **NFR-04**: All API endpoints must validate task IDs against known stage tasks

### Constraints
- **CON-01**: Existing task IDs (1-docs, 1-lead, 1-mplus, 1-jira, 1-confluence) must remain functional
- **CON-02**: Progress JSONB format must not break existing queries
- **CON-03**: Frontend must work with both old and new task IDs
- **CON-04**: HR verification step cannot be auto-completed by client click

### Actors/Clients
- **Employee**: Completes onboarding stages, signs documents, gets access, uses MPulse
- **HR/Administrator**: Verifies document receipt (Step 1), confirms access provision (Step 2)
- **System**: Persists progress, computes XP, serves API

### Core Use Cases
- **UC-01**: Employee signs documents → HR verifies → tasks marked done + 5 XP
- **UC-02**: Employee acquires access types → tasks marked done + 5 XP
- **UC-03**: Employee installs MPulse, selects schedule, enters verification code → tasks marked done + 5 XP
- **UC-04**: Employee reads Confluence sections, clicks "I have read" → tasks marked done + 10 XP

### Domain Boundaries
- **Document Signing Boundary**: Documents uploaded/verified by HR, not just client click
- **Access Boundary**: Technical checks (MAC) or person confirmation (accountant, proxy)
- **MPulse Boundary**: AD auth + code verification on backend
- **Confluence Boundary**: "I have read" button click with timestamp fixation

### Data Flows
1. **Document Signing Flow**:
   Employee → selects document type → system records task ID → HR verifies → system marks done + awards 5 XP
2. **Access Acquisition Flow**:
   Employee → completes access type → system records task ID → technical/person verification → system marks done + awards XP
3. **MPulse Flow**:
   Employee → downloads app → AD auth → selects schedule → enters verification code → system marks done + awards 5 XP
4. **Confluence Flow**:
   Employee → reads sections → clicks "I have read" → system records confirmation + awards 10 XP

### Communication Patterns
- Synchronous: Client → API → DB (task toggle, stage complete)
- API validates task ID exists in stage tasks before modifying progress
- HR verification may involve external workflow (not fully automated)

### Synchronous vs Asynchronous
- **Task toggle**: Synchronous (API → DB, immediate response)
- **HR verification**: Asynchronous (HR action → system update, may have delay)
- **MPulse code verification**: Synchronous (code entry → immediate check)
- **Confluence "I have read"**: Synchronous (button click → immediate fixation)

### Data Ownership
- **PostgreSQL (progress table)**: Owns `done_tasks` JSONB — source of truth for user completion status
- **Frontend store (zustand)**: Caches `doneTasks` for UI rendering — derived state
- **Backend stages_data.py**: Owns task definitions and XP values — reference data

### Failure Handling
- **If PostgreSQL unavailable**: Task toggle fails, user sees error, no state corruption
- **If HR verification delayed**: Task remains incomplete, user can retry later
- **If MPulse code expired**: User re-registers, gets new code
- **If Confluence button clicked twice**: Idempotent — no duplicate XP award

### Technology Selection
- **Task IDs**: String keys in JSONB (no DB schema change needed)
- **XP computation**: Existing `compute_xp()` in stages_data.py extended to include new tasks
- **Verification**: API endpoints with task ID validation; HR verification via separate workflow

### Architecture Decisions / ADRs
- **ADR-001**: Add 15 new tasks to Stage 1 (5 doc types + 5 access types + MPulse code + Confluence read + Confluence confirm)
- **ADR-002**: Keep existing 5 task IDs functional; new tasks are additive
- **ADR-003**: HR verification for Step 1 is a separate workflow step, not auto-completable
- **ADR-004**: "I have read" Confluence confirmation is idempotent (no double XP)
- **ADR-005**: MPulse verification code is single-use, same for all employees in a onboarding batch

### Deployment Architecture
- No changes to deployment — all changes are within existing backend/frontend
- Backward compatible — existing users can complete old tasks, new users get new tasks

### Implementation Plan
1. Update `backend/app/stages_data.py` — add new tasks to FALLBACK_STAGES, update _KNOWN_TASK_IDS
2. Update `backend/app/routes/stages.py` — ensure new tasks returned from DB
3. Update `backend/app/routes/progress.py` — no changes needed (task ID validation already exists)
4. Update `frontend/data/stages.ts` — add new subTasks to Stage 1
5. Update `frontend/src/components/stages/Stage1Documents.tsx` — render new document types and steps
6. Update `frontend/src/store/useOnboarding.ts` — if needed for new verification flows
7. Create `.opencode/architecture.mmd` — system architecture diagram
8. Run tests and verify

### Open Questions
- **OQ-01**: What exact point value for Step 2 "Получение доступов"? Proposed: 5 points (same as Step 1 and Step 3)
- **OQ-02**: Should HR verification be a separate API endpoint or integrated into task toggle? Proposed: Separate `POST /api/progress/verify-docs` endpoint for HR to mark documents as verified
- **OQ-03**: MPulse verification code — should it be stored per-user or be a fixed code for all? Proposed: Fixed code for all, stored in DB with usage tracking
- **OQ-04**: Confluence "I have read" — should it require authentication check? Proposed: Yes, same as other API endpoints (authenticated user only)

### Traceability Matrix
| Requirement | Implementation |
|-------------|---------------|
| FR-01 | New tasks: 1-dogovor, 1-nda, 1-pdp, 1-ip, 1-sn in Stage 1 |
| FR-02 | New tasks: 1-mbusiness, 1-accountant, 1-wifi, 1-proxy, 1-telegram in Stage 1 |
| FR-03 | New tasks: 1-mpulse-code in Stage 1; API endpoint for code verification |
| FR-04 | New tasks: 1-confluence-read, 1-confluence-confirm in Stage 1 |
| FR-05 | HR verification endpoint: POST /api/progress/verify-docs |
| FR-06 | Protection: each step requires verification before stage completion |
| FR-07 | XP: Step 1=5, Step 2=5, Step 3=5, Step 4=10 |
| NFR-01 | JSONB done_tasks persists all task IDs |
| NFR-02 | compute_xp() includes new tasks |
| NFR-03 | Old task IDs remain valid |
| NFR-04 | API validates task_id in stage["tasks"] keys |

### Mermaid Diagram Reference
See `.opencode/architecture.mmd` for the system architecture diagram.

### Sub-task Breakdown
1. Update stages_data.py — add 15 new tasks to FALLBACK_STAGES and _KNOWN_TASK_IDS
2. Update stages.py — ensure new tasks exposed via /api/stages
3. Update frontend/data/stages.ts — add new subTasks to Stage 1 definition
4. Update Stage1Documents.tsx — render new doc cards for document types, access types, MPulse, Confluence
5. Add HR verification endpoint: POST /api/progress/verify-docs (separate from task toggle)
6. Add Confluence "I have read" handler in frontend and backend
7. Add MPulse verification code handler
8. Run existing tests to ensure no regressions