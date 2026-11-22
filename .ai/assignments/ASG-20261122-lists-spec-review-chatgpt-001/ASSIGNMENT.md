# Assignment ASG-20261122-lists-spec-review-chatgpt-001

- **Objective:** an independent review, from outside the model family that wrote it, of `docs/lists-spec.md` (the Lists module spec of the Eveniunt Command Center) before any of it is built. Requested by the owner on 2026-11-22: a Claude review first (done; its fixes are in the candidate), then ChatGPT and Mistral, in the public repository.
- **Work class:** analysis (a design review; no code is run or changed).
- **Candidate:** `SplitzHappen/Eveniunt-Command-Center` pull request #4, branch `claude/blissful-fermat-hrrqp5`, head `0ef02e70124348347af684c35e02c47d60c97661`. This assignment branch starts at that commit.
- **Evidence scope:** `docs/lists-spec.md`, `docs/lists-research.md`, `CLAUDE.md`, and the source files named in `PROMPT.md`.
- **Permitted implementation writes:** none.
- **Permitted evidence writes:** `.ai/assignments/ASG-20261122-lists-spec-review-chatgpt-001/results/` and `.ai/assignments/ASG-20261122-lists-spec-review-chatgpt-001/STATUS.json` on branch `assignments/ASG-20261122-lists-spec-review-chatgpt-001` only.
- **Independent-review scope:** the whole spec, with most weight on the save and sync rules (section 4), the engine rules (section 5) and the two owner rules (section 11). The reviewer did not write the spec and is not of the family that did.
- **Tests or checks:** none to run; the review is by reading. Worked examples count as evidence.
- **Completion criteria:** `results/REVIEW.md` and `results/findings.json` committed, then `STATUS.json` terminal with `result_paths`, `result_commit`, `completed_at`, `disposition`; pushed and verified on GitHub.
- **Publication:** results only on this branch; nothing in chat; no comment on the pull request.
- **Assigned to:** ChatGPT. A sibling assignment gives the same task to the other outside reviewer; the two are read side by side.
