# Kanban Board — food-reco

**Board columns:** Backlog → Ready → In Progress → In Review (QC) → QA / Verify → Done → Blocked

---

## Status

| Epic | Cards | Progress |
|------|-------|----------|
|| M1 Scaffold & foundations | 6 | 🟢 6/6 done |
|| M2 Auth & users | 6 | 🟢 6/6 done |
|| M3 Data pipeline | 6 | 🟢 6/6 done |
|| M4 Recommendation core | 6 | 🟢 6/6 done |
|| M5 Variety, chat, feedback | 4 | 🟢 4/4 done |
|| M6 Frontend | 5 | 🟢 5/5 done |
|| M7 Deploy & CD | 5 | 🟢 5/5 done |
|| **Total** | **38** | **🟢 38/38 — all 7 epics complete** |

---

## Done

### EPIC M1 — Scaffold & foundations

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
|| M1.1 | Init repo, `.gitignore`, `.env.example`, `CONTRIBUTING.md`, branch protection, PR template | Done | main | — |
|| M1.2 | Backend skeleton (FastAPI, config, SQLAlchemy, Alembic), `/api/health` | Done | main | — |
|| M1.3 | Frontend skeleton (Vite + TS + Tailwind), base layout | Done | main | — |
|| M1.4 | CI pipeline (lint, type, test, build) green on empty app | Done | main | — |
|| M1.5 | Data model + first migration + seed CSVs | Done | main | — |
|| M1.6 | `docs/` skeleton incl. CONTEXT7_REFS.md, ARCHITECTURE.md | Done | main | — |

### EPIC M2 — Auth & users (Path B)

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
|| M2.1 | Register/login/logout, argon2, JWT httpOnly cookie, CSRF | Done | main | — |
|| M2.2 | Email verification + optional allowlist toggle | Done | main | — |
|| M2.3 | `/api/me` + `/api/me/preferences` (rich taste profile) | Done | main | — |
|| M2.4 | Per-user rate limiting (`rate_limit_bucket`) | Done | main | — |
|| M2.5 | Auth unit + integration tests; security review | Done | main | — |
|| M2.6 | `/api/cities`, `/api/feedback`, `/api/history` | Done | main | — |

### EPIC M3 — Data pipeline

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
|| M3.1 | `crawl_source` config + robots.txt/ToS honoring fetcher | Done | main | — |
|| M3.2 | Parser + normalizer (units, canonical names, dedupe) | Done | main | — |
|| M3.3 | Verification gate vs TKPI + price sanity + allergen/pregnancy tagging | Done | main | — |
|| M3.4 | Admin verify endpoints + human-queue | Done | main | — |
|| M3.5 | Provenance + private-data handling; data-QA tests | Done | main | — |
|| M3.6 | Seed a small verified starter dataset | Done | main | — |

### EPIC M4 — Recommendation core

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
|| M4.1 | Rules layer (condition/sex → targets + forbidden tags) | Done | main | — |
|| M4.2 | Price-tier resolution (province + Jabodetabek override) + budget calc | Done | main | — |
|| M4.3 | Preference scorer + `weights.py` with unit tests | Done | main | — |
|| M4.4 | Candidate filter (hard gates + preference rank + recency) | Done | main | — |
|| M4.5 | OpenRouter client, JSON contract, retry/repair, failover | Done | main | — |
|| M4.6 | `/api/plan` end-to-end + tests | Done | main | — |

### EPIC M5 — Variety, chat, feedback

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
|| M5.1 | `meal_history` logging + non-repetition window + variety_appetite tuning | Done | main | — |
|| M5.2 | `/api/chat` conversational adjustment | Done | main | — |
|| M5.3 | `/api/feedback` 👍/👎 → implicit learning into `user_taste` | Done | main | — |
|| M5.4 | `/api/history` with food details + `/api/cities` type-ahead | Done | main | — |

### EPIC M6 — Frontend

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
|| M6.1 | Auth screens + onboarding taste wizard | Done | main | — |
|| M6.2 | Searchable city dropdown with type-ahead | Done | main | — |
|| M6.3 | Plan view: interactive food cards, macro badges, budget, imagery | Done | main | — |
|| M6.4 | Chat panel + meal rating (👍/👎) | Done | main | — |
|| M6.5 | Responsive/mobile polish, Tailwind green theme, sticky nav | Done | main | — |

### EPIC M7 — Deploy & CD

| Card | Description | Status | Branch | PR |
|------|-------------|--------|--------|----|
|| M7.1 | Docker Compose (nginx + backend + crawler + cloudflared) | Done | main | — |
|| M7.2 | Multi-arch arm64 build → GHCR | Done | main | — |
|| M7.3 | Cloudflare Tunnel → food.yosuaf.com (+ optional Access) | Done | main | — |
|| M7.4 | Self-hosted Pi runner + auto-deploy on merge to main | Done | main | — |
|| M7.5 | RUNBOOK.md (deploy/rollback/crawl ops) + smoke test | Done | main | — |

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

*All epics (M1–M7) fully delivered and deployed to production at food.yosuaf.com. Board auto-mirrored from Hermes Kanban. Last updated: 2026-07-03.*