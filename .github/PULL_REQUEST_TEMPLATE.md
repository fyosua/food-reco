## Description

<!-- Link the card, summarize the change -->

Card: #[card-id]

## Acceptance criteria

- [ ] (list from card)

## QC checklist

- [ ] Meets the card's acceptance criteria
- [ ] Clean-code standards — naming, size, no dead code
- [ ] Types complete; no `any`/untyped escapes
- [ ] Tests present and meaningful (not coverage padding)
- [ ] No secrets, no private data, no unlicensed images committed
- [ ] Security: input validated, queries parameterized, authz enforced
- [ ] Performance: no obvious N+1, unbounded loops, or prompt bloat
- [ ] Docs updated (README/API/relevant `docs/*`)
- [ ] Context7 (or web search) used for any new library; refs recorded

## Test evidence

<!-- Paste test output here -->

```
$ pytest --cov --cov-report=term-missing
...
```