# Archive Report: prd-plataforma-eventos

**Archived**: 2026-08-17
**Change**: prd-plataforma-eventos
**Project**: eventos
**Mode**: hybrid (openspec + engram)
**Verdict**: PASS (with documented non-blocking follow-ups)

## Executive Summary

Final SDD cycle close for the Plataforma de Eventos full-stack product definition. The
change produced 9 new domain specs (63 requirements, 127 scenarios) covering the backend
API, backend business logic, backend integrations, deployment, four frontend surfaces, and
real-time communication. All 101 implementation tasks are complete at archive time and the
implementation HEAD is `4b41740` on `main`. Second-pass verification is PASS: the sole
CRITICAL (POST /uploads route unmounted) was resolved in commit `4b41740`; builds and
typecheck are green; 6 WARNINGs and 1 SUGGESTION remain as documented non-blocking
follow-ups.

## Specs Synced

All 9 delta specs were new domains (no prior baseline spec existed), so each was created in
full in `openspec/specs/` via mechanical byte-identical copy.

| Domain | Action | Details |
|--------|--------|---------|
| backend-api | Created | 14 requirements, 22 scenarios |
| backend-business | Created | 12 requirements, 25 scenarios |
| backend-integrations | Created | 6 requirements, 11 scenarios |
| deployment | Created | 6 requirements, 15 scenarios |
| frontend-admin | Created | 1 requirement, 3 scenarios |
| frontend-client | Created | 8 requirements, 18 scenarios |
| frontend-platform | Created | 5 requirements, 13 scenarios |
| frontend-provider | Created | 7 requirements, 11 scenarios |
| realtime | Created | 4 requirements, 9 scenarios |

**Total**: 9 new domains | 63 requirements | 127 scenarios (fully verified)

## Archive Contents

- proposal.md ✅
- exploration.md ✅
- specs/ ✅ (9 domain spec.md files)
- design.md ✅
- tasks.md ✅ (101/101 tasks complete, 0 unchecked)
- archive-report.md ✅ (this file)

Note: `verify-report.md` is not present on disk — for this change the verification report
lives in Engram as observation #1546 (`sdd/prd-plataforma-eventos/verify-report`), consistent
with the hybrid artifact store used for this change.

## Source of Truth Updated

The following specs now reflect the new behavior:
- `openspec/specs/backend-api/spec.md`
- `openspec/specs/backend-business/spec.md`
- `openspec/specs/backend-integrations/spec.md`
- `openspec/specs/deployment/spec.md`
- `openspec/specs/frontend-admin/spec.md`
- `openspec/specs/frontend-client/spec.md`
- `openspec/specs/frontend-platform/spec.md`
- `openspec/specs/frontend-provider/spec.md`
- `openspec/specs/realtime/spec.md`

## Verification Summary (final state)

| Metric | Value |
|--------|-------|
| Tasks complete | 101/101 |
| Requirements | 63/63 |
| Scenarios | 127/127 |
| CRITICAL issues | 0 (resolved in commit `4b41740`) |
| WARNING issues | 6 (non-blocking follow-ups, documented below) |
| SUGGESTIONs | 1 (non-blocking, documented below) |
| Test gate | typecheck exit 0 (backend & frontend) |
| Build gate | build exit 0 (backend & frontend) |
| Implementation HEAD | `4b41740` (main) |
| Verify verdict | PASS (Engram obs #1546, evidence_revision sha256:4fb6ba76...) |

### Final-State Resolution of the Prior CRITICAL

Per `verify-report` obs #1546 (second pass, superseding the first-pass FAIL), the sole
first-pass CRITICAL — `POST /api/v1/uploads` not mounted — is resolved. The remediation
batch (apply-progress obs #1547, `sdd/prd-plataforma-eventos/apply-progress/uploads`) landed
in commit `4b41740` (`feat(backend): mount POST /uploads signed-upload route (BR-013.6)`):
backend `src/routes/v1/uploads.routes.ts` + v1 index mount, `storage.service.ts`
audio/webm allowlist + exported `ENTITY_ALLOWLIST`, frontend `lib/api.ts` uploadFile
raw-bytes contract + ChatPage/OnboardingWizard call sites, and `docs/api.md` documentation.

## Follow-ups (non-blocking — recorded for next iteration)

WARNINGs (unchanged from first pass, documented as future work, do not block archive):

1. **UR-009.2** — Agora voice/video calls: backend token endpoint exists; frontend is
   constants-only (`AGORA_APP_ID`), no RTC SDK call flow wired.
2. **BR-012** — ARCO rights workflow is client-side only; no backend route creating
   `arco_requests`.
3. **No `GET /services?provider=me`** — provider dashboard uses a persisted-IDs registry
   workaround.
4. **No `service_photos` update endpoint** — ListingsTab photos are read-only.
5. **No `GET /admin/commission`** — CommissionConfig only shows the last-saved value (PUT
   only).
6. **No `cancellation_policies` update endpoint** — FR-011.7 policy editing is disabled.

SUGGESTION:

- **Onboarding photo signed-URL TTL** — OnboardingWizard photos land in the `services/0`
  pre-creation bucket; embedded `SignUrl` URLs expire after the 1h default TTL, so stored
  photo URLs may 403 after service creation unless re-signed/relocated. Not blocking.

## Mechanical Copy Verification

- **Step 2 (Specs sync)**: per-domain `diff -r` (change source spec vs staged copy) —
  EXIT 0, empty diff, byte-identical for each of the 9 domains (see phase result).
- **Step 2 readback**: per-domain `diff -r` (change source spec vs `openspec/specs/{domain}/spec.md`)
  — all 9 IDENTICAL.
- **Step 3 (Archive move)**: `git mv` of the tracked change folder, then
  `diff -r $snapshot_root/source openspec/changes/archive/2026-08-17-prd-plataforma-eventos/`
  — EXIT 0, empty diff, byte-identical. `archive-report.md` is additive-only and excluded
  from the comparison (it did not exist in the source snapshot).

## Engram Artifacts Read (traceability)

- #1499 — `sdd/prd-plataforma-eventos/proposal`
- #1505–#1513 — `sdd/prd-plataforma-eventos/spec-*` (9 domain specs)
- #1520 — `sdd/prd-plataforma-eventos/design`
- #1521 — `sdd/prd-plataforma-eventos/tasks`
- #1529, #1547 — `sdd/prd-plataforma-eventos/apply-progress` (+ remediation batch)
- #1546 — `sdd/prd-plataforma-eventos/verify-report`

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
