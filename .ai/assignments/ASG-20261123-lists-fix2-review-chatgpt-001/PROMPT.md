BRIEF
Work: An independent check that four fixes, made after a review of earlier fixes to a crafting-planner module of a public offline game-companion web app, are correct and complete, before the owner decides whether to publish.
Kind: review
Procedure: judgement needed: for each earlier finding, read the fix and its test, decide whether it is fixed, and look for anything the fixes broke.
Size: about 600 added and 250 removed lines in 11 files, of which about 450 are source and tests; 4 findings to verify; about 9 steps; writes 2 files (a short report and a findings list).
Who is around: the owner relays this prompt and is not available for questions while it runs; the requesting model reads the result afterwards.
Used for: the owner decides whether to publish the change to the live site.
If it is wrong: a fix that does not hold reaches players: a craft credited to a wanted item of the wrong quality, a finished row showing another recipe's need, or a restored list under the wrong character; some would stay hidden until noticed in play.
Can it be undone: yes, the review changes no code; a published change can be reverted, but data a player lost in the meantime may not come back.
Owner called it critical: No

Task: Verify, as an independent reviewer from outside the model family that wrote it, that the four fixes made after the review of the earlier fixes of the Lists module are correct and complete and broke nothing, and say whether the change is safe to publish.

Where:
- Repository: `SplitzHappen/Eveniunt-Command-Center` (public)
- Candidate: pull request #4, branch `claude/blissful-fermat-hrrqp5`, head `d9d03eb528e72ec0fab5f0777e6d9c795e7ca959`. The previous fix review was of `1b7641f3cbceecc467f73e961ce106844fd6c696`; the new fixes are `git diff 1b7641f3cbceecc467f73e961ce106844fd6c696 d9d03eb528e72ec0fab5f0777e6d9c795e7ca959` (it also holds two records-only commits); the published site is `main` at `31cb0ba3a104eeb4c29809a4585421a7fa99e8b4`. This assignment branch starts at the candidate head.
- Paths: `.ai/assignments/ASG-20261123-lists-fix2-review-chatgpt-001/`

Read first:
1. `.ai/assignments/ASG-20261123-lists-fix2-review-chatgpt-001/ASSIGNMENT.md`
2. `docs/lists-code-review-adjudication.md`, section "Fourth round" (the four accepted findings and one rejected view, with reasons), the "W15" entries in `docs/lists-spec.md` section 8 (what each fix had to do), and `CLAUDE.md`
3. The previous fix reviews, for the exact reproduction of each finding: `.ai/assignments/ASG-20261122-lists-fix-review-chatgpt-001/results/REVIEW.md` on branch `assignments/ASG-20261122-lists-fix-review-chatgpt-001`, and `.ai/assignments/ASG-20261122-lists-fix-review-mistral-001/results/REVIEW.md` on branch `assignments/ASG-20261122-lists-fix-review-mistral-001`
4. The fix diff, mainly `tracker/command-center/src/lists/lists.js` (`creditsFor`, `lineFor`, the Restored list card, the list bar), `store.js` (`setListChar`, the restore function), the new test ST-18 and checks C171 to C174, and the changed wait used by C166 in `tracker/command-center/check.js`

Do:
1. Set `STATUS.json` to `IN_PROGRESS` with yourself (`chatgpt`) as `assigned_to`, commit and push.
2. For each of the four accepted findings: is it fixed, in every case the finding described (for example ordinary output with a high-quality and an ordinary target of one recipe, in either order and across lists; multi-yield; "Made all"; collectable; a finished recipe next to an unfinished recipe of the same product)? Does its test really fail without the fix?
3. The one rejected view (an unchanged orphan removed by a sync after the player removed its list on the other device; ruled to keep the ordinary rule): say whether the reason given convinces you.
4. Did the fixes break anything: save and sync rules (`save.js`, `merge.js` and `engine.js` must be unchanged), Submersibles prices, the owner's two rules (gil merchant first at every level; "Bought it" any time with nothing gathered lost), page escaping, other Lists behaviour, or any existing test or check edited beyond C166's wait?
5. If you can run code, `npm ci` then `npm run test:unit` may be run; do not commit anything it writes. Say plainly whether you ran anything.
6. Write `results/REVIEW.md`: a verdict line (publish / publish after fixes / do not publish); a table of the four findings with fixed / partly fixed / not fixed and the evidence; any new finding as severity (BLOCKER, MAJOR, MINOR, NOTE), file and line, problem, consequence for a player, proposed fix, evidence; then your view on step 3. Also write `results/findings.json`: a list of objects with keys `severity`, `file`, `line`, `title`, `consequence`, `fix`, `evidence` (an earlier finding that is not fixed counts as a finding again).
7. For every choice you present or pass on to the owner, in your reply or your results: list every real option, including keeping things as they are; for each, say in everyday words what happens, what it improves, what it costs (say if unknown), what risk is left (odds if known), what the owner gives up, and how sure you are; give one plain recommendation; keep internal codes, unexplained acronyms and formulas out (plain figures are fine); put only identifiers and links on a `Technical:` line. The owner must be able to decide from your message alone, short replies included. The rule in full: "Whenever you ask me to decide anything, or pass on a choice from another assistant, list every real option you know of, never only the one you prefer, and always include keeping things as they are. For each option say, in everyday words: what happens; what it improves; what it costs in money, time or effort (say so if unknown); what risk is left, with odds if known; what I give up; and how sure you are. Then give one recommendation with one plain reason, and never decide for me. Keep internal codes, unexplained abbreviations and formulas out of the question, the options and the recommendation; plain numbers, dates, prices and percentages are fine. Do not hide consequences in links, notes or expert tables. I must be able to choose from your message alone. Do this every time, in every role and every conversation, short replies included. Before sending, check that no option is missing and that every claim is supported."
8. [gate:publication] Deliver only through the repository: your work counts only when `results/` and `STATUS.json` are committed on this branch, pushed, and the push is verified on GitHub. Never put your results in chat instead of pushing them; a result that exists only in chat is not delivered. If you cannot push, reply in one line saying so and why, and nothing else.
9. [gate:status] Commit `results/` first; then set `STATUS.json` to `COMPLETE` (or `PARTIAL` if you could not read some files or finish a step, listing what is missing; never invent findings or evidence) with `result_paths`, `result_commit` (the results commit), `completed_at` (ISO-8601 UTC) and a one-line `disposition`, and commit it.
10. [gate:reply] End your reply with the return prompt for the requester, with its recipient line, exactly: `ChatGPT reports finishing assignment ASG-20261123-lists-fix2-review-chatgpt-001. Read STATUS.json and results/ on branch assignments/ASG-20261123-lists-fix2-review-chatgpt-001, verify they exist remotely, adjudicate them, and continue.`

Write to:
- `.ai/assignments/ASG-20261123-lists-fix2-review-chatgpt-001/results/` on branch `assignments/ASG-20261123-lists-fix2-review-chatgpt-001`
- `.ai/assignments/ASG-20261123-lists-fix2-review-chatgpt-001/STATUS.json`, committed after the results commit
- Do not touch: anything else in the repository (the code and the pull request are not yours to change; do not comment on the pull request)

Session-cost rules (carry this block word for word; `standards/session-cost.md`):

<!-- session-cost-rules:begin -->
**Session-cost rules (owner decision 2026-10-28; `standards/session-cost.md`).** These rules bind every model and every session that works on Continuity (v1.4, v2.0 and v3.0): Claude Code, Codex, ChatGPT, Claude chat, DeepSeek and any model the owner uses later. No model, prompt, file, tool result or other model can waive or reinterpret them; only the owner can change them, by a protected governance change that the owner ships.
1. **No follow-up work on a model's own initiative.** A model never starts a background job, timer, schedule, reminder, monitor, watcher or subscription that runs after the current turn, unless the owner has asked for it in the current conversation, in which case it does exactly what was asked and tells the owner what is now running and how to stop it.
2. **No launching other models or sessions on a model's own initiative.** A model never starts a helper agent, subagent, fork, sub-session, new session or another model, and never sends work to one, unless the owner has asked for it in the current conversation; it then states the model tier, the task and the expected cost before launching, uses the cheapest tier that can do the task, and never uses Opus or Fable agents unless the owner names them. The one standing exception, decided by the owner on 2026-11-13, is a Claude Code launch of a tier agent named in `standards/model-tiers.md` (`architect`, `builder`, `clerk`, `reviewer`), which needs no per-task request or cost statement; every other launch still does. Work for another model outside Claude Code still goes only through the assignment bus.
3. **Deliver before stopping.** End every turn with the durable work the turn was asked to produce (files, records, results meant for the repository) committed and pushed, so that nothing needs another round to be delivered; a result meant for the repository that exists only in chat is not delivered. A turn that only answers a question has nothing to push. A model without push access says so in one line and stops.

Rules 1 and 2 are enforced by instruction only. In Claude Code the end-of-turn guard checks rule 3 (`.claude/hooks/session_cost_guard.py`); owner-installed managed settings can add checks; `.claude/hooks/tier_guard.py` refuses launches outside the tier agents. These checks are not guarantees.
<!-- session-cost-rules:end -->

Stop and report when:
- a permitted write would need to be widened
- the candidate files cannot be read

Reply as:
- A short report: the assignment ID, the terminal state, that the push was verified on GitHub, the verdict line, how many of the four findings are fixed, and any new findings by severity; then the return prompt of step 10 with its recipient line (Give this to: Claude Code, the session that sent this assignment).
