# Assignment ASG-20261123-lists-redesign-review-chatgpt-001

- **Objective:** an independent review, from outside the model family that built it, of the look and the code of the redesigned and extended Lists module before the owner decides whether to publish it. Requested by the owner on 2026-11-23 (option B of the ship request after the red team).
- **Work class:** audit (a review; no code is changed).
- **Candidate:** `SplitzHappen/Eveniunt-Command-Center` pull request #7, branch `claude/blissful-fermat-hrrqp5`, head `ec24562d3a1ee12ac5f99e7bed4b66a3904c3e33`; last outside-reviewed Lists at `cfae181` (merge commit of pull request #4); base `main`. This assignment branch starts at the head.
- **Evidence scope:** `git diff cfae181 ec24562d3a1ee12ac5f99e7bed4b66a3904c3e33`; the built screens `docs/lists-redesign/build/*.png`; `docs/design-rules.md`, `docs/lists-look-spec.md`, `docs/lists-redteam.md`, `docs/lists-spec.md`, `docs/STATE.md`, `CLAUDE.md`.
- **Permitted implementation writes:** none.
- **Permitted evidence writes:** `.ai/assignments/ASG-20261123-lists-redesign-review-chatgpt-001/results/` and `.ai/assignments/ASG-20261123-lists-redesign-review-chatgpt-001/STATUS.json` on branch `assignments/ASG-20261123-lists-redesign-review-chatgpt-001` only.
- **Independent-review scope:** appearance first (house style, approved mock-ups, game feel), then game facts, behaviour against the owner's rules, and data safety.
- **Tests or checks:** optional (`npm run test:unit` if the reviewer can run code); pictures, sheet rows and worked examples count as evidence.
- **Completion criteria:** `results/REVIEW.md` and `results/findings.json` committed, then `STATUS.json` terminal with `result_paths`, `result_commit`, `completed_at`, `disposition`; pushed and verified on GitHub.
- **Publication:** results only on this branch; nothing in chat; no comment on the pull request.
- **Assigned to:** ChatGPT. A sibling assignment gives the same task to the other outside reviewer.
