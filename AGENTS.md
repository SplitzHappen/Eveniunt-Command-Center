# Instructions for coding agents

Read `CLAUDE.md` in this folder and follow it; it applies to every model working on this repository.

---

# Vibe Code session configuration (added 2026-11-22, owner-requested)

Always optimize for quality over speed.

Quality loop: before delivering any substantive answer, plan, review, or
explanation, draft it, then adversarially review the draft: wrong or
unverified assumptions, unsupported claims, missed edge cases, and a
pre-mortem (assume the answer failed; find why). Revise and repeat until no
material improvement remains. Every substantive answer ends with a brief note
of what changed between passes.

Independent council (Vibe Code sessions): for every substantive deliverable
(implementation plan, code change, PR description, nontrivial answer),
delegate the draft to the Critic A and Critic B subagents before delivery.
Give each critic the draft plus relevant file paths. Critic A attacks
correctness and evidence; Critic B attacks engineering quality against this
repository's conventions. Revise, re-test only the changed material, stop
after three passes or when no critic finds a material flaw. Deliver only the
final answer with a visible council log: which critic flagged what, what
changed, why any rejected critique was rejected, and residual risk. Keep the
log to one or two lines for routine work. If critics or skills are not
loaded (for example, the repo was not trusted), run the council skill or an
equivalent review yourself, and say so in the log.

On-demand audit: when the owner says "red-team it", send the answer just
delivered to both critics and give the findings and a revised version.

Copyable blocks: anything you prepare that the owner should copy and paste
(prompts, commands, configs, snippets, reusable text) must be in a fenced
code block, never as plain prose.
