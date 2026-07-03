# Contributing — food-reco

## Git rules

- **`main` is always deployable.** No direct pushes — PR-only, green CI required.
- **One card → one branch → one PR.** Feature branches: `feat/<card-id>-slug`. Also: `fix/`, `chore/`, `docs/`, `refactor/`.
- **Conventional Commits:** `type(scope): summary`
  - Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`
  - Scope: `auth`, `api`, `reco`, `crawler`, `pricing`, `llm`, `frontend`, `infra`, `docs`
  - Body explains *why* when non-obvious
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Squash-merge** to keep history linear. Delete branches after merge.

## QA/QC gates

Nothing merges without both:

### QA — automated tests
- Backend: `ruff check . && mypy . && pytest --cov`
- Frontend: `npm ci && npx eslint . && npx tsc --noEmit && npx vitest run && npm run build`
- Coverage gate: ≥80% on `reco/`, `pricing/`, `crawler/verify`, `auth/`

### QC — review checklist (every PR)
- [ ] Meets the card's acceptance criteria
- [ ] Clean-code standards — naming, size, no dead code
- [ ] Types complete; no `any`/untyped escapes
- [ ] Tests present and meaningful (not coverage padding)
- [ ] No secrets, no private data, no unlicensed images committed
- [ ] Security: input validated, queries parameterized, authz enforced
- [ ] Performance: no obvious N+1, unbounded loops, or prompt bloat
- [ ] Docs updated (README/API/relevant `docs/*`)
- [ ] Context7 (or web search) used for any new library; refs recorded

## Coding standards

- **Small, single-responsibility** functions/modules; clear names
- **Typed everywhere:** TypeScript (no implicit `any`), Python type hints + Pydantic
- **No dead code, no commented-out blocks, no dangling TODOs**
- **Docstrings/JSDoc** on public functions; module-level docstring
- **Config over magic numbers** — tunables in named config, documented
- **Correct first, then optimize** what profiling shows matters

## Security

- No secrets, full dataset, or unlicensed images in the public repo
- `.gitignore` covers `.env`, `*.db`, private data files
- Argon2 passwords, httpOnly JWT cookies, parameterized queries, rate limits
- Generic auth error messages (never leak "user exists" vs "wrong password")