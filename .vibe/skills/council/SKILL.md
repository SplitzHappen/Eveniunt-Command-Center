---
name: council
description: Pre-delivery multi-perspective review council. Load when drafting
  or revising any substantive answer, and whenever the owner mentions the
  council or asks to red-team, stress-test, or review a draft from multiple
  perspectives before delivery.
---

# The Council

A panel of perspective-based reviewers that scrutinizes a draft before
delivery, sitting on top of the standard quality loop (draft, adversarial
review, pre-mortem, revise, visible pass notes).

## Honest limits

Council seats are perspectives of the same underlying model, not independent
models. They reduce blind spots through structured disagreement; they do not
remove them. If asked, say this plainly; never present council output as
independent external review.

## When to convene

- Every substantive answer: light council (Editor, Adversary, plus one seat
  matched to the topic).
- Complex, high-stakes, or when the owner asks for "the council" or
  "red-team it": full council, iterative passes.
- Trivial or mechanical replies (tool output, confirmations, one-line facts):
  skip the council; the standard loop still applies if the reply contains a
  claim worth checking.

## Seats

Adapt to the topic and drop seats with nothing material to say; never pad.

1. The Adversary: strongest case against the draft's conclusion or
   recommendation. What would make this wrong?
2. The Fact-Checker: every claim traced to evidence. Flags inference dressed
   as fact, stale specifics, unverifiable numbers, sources not actually read.
3. The Domain Expert: subject-matter scrutiny a generalist misses: wrong
   method, wrong genre convention, missing context.
4. The Editor: writing quality: AI-slop patterns, jargon walls, inflated
   significance, canned structure.
5. The Audience: the actual reader (the owner, a user, a contributor):
   intelligible, useful, actionable to them.
6. The Projector: pre-mortem analyst. Assume the delivered answer failed;
   name the failure modes and what the draft should have covered.

## Procedure

1. Draft the answer through the standard quality loop.
2. Each seat reviews the draft independently; findings are ranked material
   vs. cosmetic. Cosmetic fixes are made silently.
3. Synthesize: group findings; when two seats disagree, resolve on evidence
   or surface the tradeoff to the owner instead of hiding it.
4. Revise; re-test only the changed or disputed material.
5. Stop when no seat finds a material flaw, or after 3 passes, whichever
   comes first. Report what the council could not resolve.

## Output contract

Deliver only the final answer, then a visible Council log. Always:

- One line per seat that found something material: what it flagged and what
  changed.
- If a seat's concern was rejected, one line on why, so rejected critiques are
  visible, not silent.
- One line of residual unresolved risks.
- Light-council answers: compress the whole log to one or two lines.

## Relationship to other reviews

The standing quality loop is the floor; the council sits on top of it.
Pressure-testing the owner's own ideas on request is a different mode: there,
attack the idea; here, review the draft.
