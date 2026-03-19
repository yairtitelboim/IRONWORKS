# Local Additions Integration Plan (Phased)

This runbook documents how to merge current local additions into GitHub with low risk and easy rollback.

Current state:
- `main` and `origin/main` are aligned at commit history level.
- All differences are currently uncommitted local changes.
- Strategy: stage and ship in phases on a dedicated branch.

---

## 1) Create Dedicated Integration Branch

```bash
git checkout -b integration/feasibility-rollout
git status --short --branch
```

---

## 2) Phase A - Backend/Data Path Hardening

Goal: stabilize queue metrics fetch, cache, and abuse controls first.

Files:
- `api/location-queue-metrics.js`
- `src/hooks/useAIQuery.js`
- `server.js`
- `README.md` (queue-metrics contract/rollout notes only)

Commands:

```bash
git add api/location-queue-metrics.js src/hooks/useAIQuery.js server.js README.md
git commit -m "$(cat <<'EOF'
feat(queue-metrics): harden API path with cache and abuse controls

Route location queue metrics through the server API path with clearer fallback behavior, cache controls, and rate-limit handling to reduce client-side exposure and improve resilience.
EOF
)"
```

Validation:
- Search address returns metrics.
- `pending -> ready/fallback` states behave as expected.
- No broken local dev path for `/api/location-queue-metrics`.

---

## 3) Phase B - Core Feasibility UX (Vertical Slice)

Goal: land the main user-facing feature in one coherent commit.

Files:
- `src/components/Map/components/Cards/LocationSearchCard.jsx`
- `src/components/Map/components/Cards/FeasibilityVerdictCard.jsx` (new)
- `src/components/Map/components/Cards/CardManager.jsx`
- `src/components/Map/components/Cards/BaseCard.jsx`
- `src/components/Map/components/Cards/AIResponseDisplayRefactored.jsx`

Commands:

```bash
git add \
  src/components/Map/components/Cards/LocationSearchCard.jsx \
  src/components/Map/components/Cards/FeasibilityVerdictCard.jsx \
  src/components/Map/components/Cards/CardManager.jsx \
  src/components/Map/components/Cards/BaseCard.jsx \
  src/components/Map/components/Cards/AIResponseDisplayRefactored.jsx
git commit -m "$(cat <<'EOF'
feat(feasibility): add verdict card and nearby-site decision workflow

Introduce feasibility verdict UX, contextual metric actions, and nearby-site flow to make location search more prescriptive while preserving loading/fallback behavior.
EOF
)"
```

Validation:
- Verdict renders in both card render paths.
- Primary CTA behavior changes correctly by verdict/status.
- Nearby cards load, select, and fly-to without breaking state sync.

---

## 4) Phase C - Interaction/Map Coordination Polish

Goal: isolate broader UI orchestration changes from core feature commit.

Files:
- `src/components/Map/components/Cards/NestedCircleButton.jsx`
- `src/components/Map/components/LayerToggle.jsx`
- `src/components/Map/components/styles/LayerToggleStyles.jsx`
- `src/components/Map/components/TexasDataCentersLayer.jsx`
- `src/components/Map/components/ERCOTGISReportsLayer.jsx`
- `src/components/Map/index.jsx`
- `.vercelignore`

Commands:

```bash
git add \
  src/components/Map/components/Cards/NestedCircleButton.jsx \
  src/components/Map/components/LayerToggle.jsx \
  src/components/Map/components/styles/LayerToggleStyles.jsx \
  src/components/Map/components/TexasDataCentersLayer.jsx \
  src/components/Map/components/ERCOTGISReportsLayer.jsx \
  src/components/Map/index.jsx \
  .vercelignore
git commit -m "$(cat <<'EOF'
refactor(map-ui): align card interactions and map coordination behavior

Apply supporting interaction and layer-toggle updates required by the feasibility workflow while keeping map/card orchestration changes separately reviewable.
EOF
)"
```

Validation:
- Nested button actions still route correctly.
- Layer toggle behavior and styles remain stable.
- No regressions in map interaction / card sync.

---

## 5) Phase D - Docs-Only Follow-Up

Goal: keep product docs separate from runtime behavior changes.

Files:
- `UI_IMPROVEMENTS.md`
- `MOBILE_QA_PLAN.md`
- `CTA_STRATEGY.md`

Commands:

```bash
git add UI_IMPROVEMENTS.md MOBILE_QA_PLAN.md CTA_STRATEGY.md
git commit -m "$(cat <<'EOF'
docs: add phased feasibility rollout and QA/CTA planning notes

Document rollout phases, QA focus areas, and CTA strategy to support controlled integration and measurement.
EOF
)"
```

---

## 6) Push and Open PR

```bash
git push -u origin integration/feasibility-rollout
```

PR recommendation:
- Base: `main`
- Include 4 commits (A/B/C/D) so review can happen by phase.

---

## 7) Build/Test Notes

- Local build in this repo may fail under strict CI warning rules.
- Practical gate for phased integration:

```bash
CI= npm run build
```

- Also run manual smoke checks on:
  - location search -> queue metrics load states
  - feasibility verdict + CTA paths
  - nearby-site selection + fly-to behavior
  - map/card synchronization

---

## 8) Rollback Strategy

- If a regression appears, revert only the affected phase commit.
- Keeping features separated by phase makes rollback low-risk.

