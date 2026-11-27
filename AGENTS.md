# Instructions for coding agents

Read `CLAUDE.md` in this folder and follow it; it applies to every model working on this repository.

---

# Standing mandates for this repository (all Code sessions)

Quality over speed, always. These mandates are not suggestions; they apply to every review and every build in this environment, and to your own output as much as to anything you review for the owner.

## 1. Reviews and audits: read everything

When the owner gives you material to review, read 100% of it before saying anything about it. Every file, end to end, in sequential chunks if needed. Never review from excerpts, samples, summaries, or search snippets.

Enumerate every checkable claim and give each a state: verified-true, verified-false, or unchecked-with-reason. Work adversarially: assume the artifact is broken and try to prove it. Lift every stone.

Iterate as many or as few times as the work actually needs: there is no fixed pass count. Stop when a full iteration finds nothing material, and say so plainly instead of inventing findings.

Never report "pass" on anything not verified against fresh evidence in this session. Recollection is not evidence. End every review with a coverage statement: what was checked, how, what was not, and where each source came from. Label every inference, estimate, and not-re-checked item as such. Use one ID per repeated issue, listing every location where it occurs.

## 2. The council: a different model on every iteration

After you draft any substantive answer, verdict, or code change, do not deliver it yet. Run the council iterations by spawning the council subagents: council-adversary, council-premortem, council-factchecker. They are pinned to different models on purpose; that is the point of them.

Each review iteration must run on a different model than the previous iteration, and the first review iteration must never run on the model that produced the draft. Skip any reviewer whose model matches the session's active model, and never run the same reviewer twice in a row.

Give each reviewer the actual files and evidence, never your summaries of them. Incorporate their findings, fix, and iterate until a full iteration returns nothing material.

If the council subagents are not available in this environment (for example, the repository was not trusted, or this is a sandboxed session), run the same review perspectives yourself in a single model, iterate by the same rules, and disclose plainly in the council log that the cross-model check did not happen.

Deliver with a visible council log: what each model flagged, what changed as a result, which critiques were rejected and why, and the residual risk. Keep the log to one or two lines for routine work.

## 3. Building: the code workflow

Write the code with the session's selected model, and test it once with that same model as part of the normal process. Actually run it: the test suite, the command, the build. Never claim a test passed without its fresh output in this session.

Then the iterative red-teaming and pre-mortem of the code run through the council, following section 2. Fix what they find, re-run the tests after each fix, and repeat until an iteration returns nothing material.

Disclose unexecuted tests, limitations, and assumptions plainly. If something was not run, say so.

## 4. Every substantive deliverable

End with the pass note: what changed between review passes, or a plain statement that a pass found nothing material. Findings are stated factually with evidence, no praise in verdicts.

On-demand audit: when the owner says "red-team it", critique the answer just delivered through the council and return the findings and a revised version.

Copyable blocks: anything you prepare that the owner should copy and paste (prompts, commands, configs, snippets, reusable text) must be in a fenced code block, never as plain prose.
