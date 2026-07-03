# Kanban Board — food-reco

**Board columns:** Backlog → Ready → In Progress → In Review (QC) → QA / Verify → Done → Blocked

**WIP limits:** In Progress ≤ 2 | In Review ≤ 3 | QA / Verify ≤ 3 | Ready ≤ 8

---

## Status

| Epic | Cards | Progress |
|------|-------|----------|
|| M1 Scaffold & foundations | 6 | 🟢 5/6 done (M1.4 CI WIP) |
|| M2 Auth & users | 5 | ⬜ Not started |
|| M3 Data pipeline | 6 | ⬜ Not started |
|| M4 Recommendation core | 6 | ⬜ Not started |
|| M5 Variety, chat, feedback | 4 | ⬜ Not started |
|| M6 Frontend | 5 | ⬜ Not started |
|| M7 Deploy & CD | 5 | ⬜ Not started |

---

## Backlog

### EPIC M1 — Scaffold & foundations

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
|| M1.1 | Init repo, `.gitignore`, `.env.example`, `CONTRIBUTING.md`, branch protection, PR template | Done | main | — |
|| M1.2 | Backend skeleton (FastAPI, config, SQLAlchemy, Alembic), `/api/health` | Done | main | — |
|| M1.3 | Frontend skeleton (Vite + TS + Tailwind), base layout | Done | main | — |
|| M1.4 | CI pipeline (lint, type, test, build) green on empty app | In Progress | — | — |
|| M1.5 | Data model + first migration + seed CSVs | Done | main | — |
|| M1.6 | `docs/` skeleton incl. CONTEXT7_REFS.md, ARCHITECTURE.md | Done | main | — |

### EPIC M2 — Auth & users (Path B)

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
|| M2.1 | Register/login/logout, argon2, JWT httpOnly cookie, CSRF | Done | main | — |
|| M2.2 | Email verification + optional allowlist toggle | Backlog | — | — |
|| M2.3 | `/api/me` + `/api/me/preferences` (rich taste profile) | Backlog | — | — |
|| M2.4 | Per-user rate limiting (`rate_limit_bucket`) | Backlog | — | — |
|| M2.5 | Auth unit + integration tests; security review | Backlog | — | — |

### EPIC M3 — Data pipeline

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
| M3.1 | `crawl_source` config + robots.txt/ToS honoring fetcher | Backlog | — | — |
| M3.2 | Parser + normalizer (units, canonical names, dedupe) | Backlog | — | — |
| M3.3 | Verification gate vs TKPI + price sanity + allergen/pregnancy tagging | Backlog | — | — |
| M3.4 | Admin verify endpoints + human-queue | Backlog | — | — |
| M3.5 | Provenance + private-data handling; data-QA tests | Backlog | — | — |
| M3.6 | Seed a small verified starter dataset | Backlog | — | — |

### EPIC M4 — Recommendation core

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
| M4.1 | Rules layer (condition/sex → targets + forbidden tags) | Backlog | — | — |
| M4.2 | Price-tier resolution (province + Jabodetabek override) + budget calc | Backlog | — | — |
| M4.3 | Preference scorer + `weights.py` with unit tests | Backlog | — | — |
| M4.4 | Candidate filter (hard gates + preference rank + recency) | Backlog | — | — |
| M4.5 | OpenRouter client, JSON contract, retry/repair, failover | Backlog | — | — |
| M4.6 | `/api/plan` end-to-end + tests | Backlog | — | — |

### EPIC M5 — Variety, chat, feedback

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
| M5.1 | `meal_history` logging + non-repetition window | Backlog | — | — |
| M5.2 | `/api/chat` conversational adjustment | Backlog | — | — |
| M5.3 | `/api/feedback` 👍/👎 + implicit learning into `user_taste` | Backlog | — | — |
| M5.4 | `/api/history`, `/api/cities` type-ahead | Backlog | — | — |

### EPIC M6 — Frontend

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
| M6.1 | Auth screens + onboarding taste wizard | Backlog | — | — |
| M6.2 | Searchable city dropdown | Backlog | — | — |
| M6.3 | Plan view: interactive food cards, macro badges, budget, imagery | Backlog | — | — |
| M6.4 | Chat panel + meal rating | Backlog | — | — |
| M6.5 | Responsive/mobile polish, WebP images, a11y pass | Backlog | — | — |

### EPIC M7 — Deploy & CD

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
| M7.1 | Docker Compose (nginx + backend + crawler + cloudflared) | Backlog | — | — |
| M7.2 | Multi-arch arm64 build → GHCR | Backlog | — | — |
| M7.3 | Cloudflare Tunnel → food.yosuaf.com (+ optional Access) | Backlog | — | — |
| M7.4 | Self-hosted Pi runner + auto-deploy on merge to main | Backlog | — | — |
| M7.5 | RUNBOOK.md (deploy/rollback/crawl ops) + smoke test | Backlog | — | — |

---

## Blocked

*None currently.*

---

## Definition of Ready (card → In Progress)

- [ ] Acceptance criteria written and unambiguous
- [ ] Dependencies identified and unblocked
- [ ] Test approach noted
- [ ] Relevant Context7 library IDs identified

## Definition of Done (card → Done)

- [ ] Merged to main via reviewed PR; CI green
- [ ] Unit + integration tests passing; coverage gate met (≥80% on reco/, pricing/, crawler/verify, auth/)
- [ ] QC review checklist satisfied (§14.3)
- [ ] Docs updated (README/API/relevant docs/)
- [ ] No new lint/type errors; no dead code; no committed secrets
- [ ] Acceptance criteria QA-verified on running build

*Board auto-mirrored from Hermes Kanban. Last updated: 2026-07-02.*