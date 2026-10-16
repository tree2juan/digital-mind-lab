# WebQuest Learning Map — Mind in Control / Mente en Control

## 1. Authoritative structure: the existing class assignment, preserved

The app's section order and headings are **the same headings, in the same
order, as the original WebQuest assignment document** (this is stated
verbatim in a source comment above `STEPS` in `index.html` and predates
this modernization pass). Per the directive's explicit instruction to
"maintain compatibility with the existing class assignment's required
WebQuest structure," **these headings were not renamed** to match the
directive's own generic suggested list (Introduction / Task / Process /
Resources / Evaluation / Conclusion) where the two differ — see the
mapping table below for how they correspond conceptually.

| This app's section | Directive's generic phase | Pages inside it |
|---|---|---|
| **Introduction** | Introduction | `intro` — essential question + cognitive-offloading framing + Meet the Team teaser |
| **Task** | Task | `task` — the three checkpoints and three possible identities, explained up front |
| **Process** | Process | `process`, then the 3 checkpoints (`cp1`/`cp1r`, `cp2`/`cp2r`, `cp3`/`cp3r`) |
| **Result** | *(closest to "Conclusion")* | `selfeval`, `identity`, `card`, `final` — scoring, identity reveal, printable identity card, final written reflection |
| **Evaluation** | Evaluation | `evaluation` — the grading-criteria explanation page |
| *(not in the directive's list — added value)* | — | **Meet the Team** — student author bios; **Resources** — the 5 academic citations |

"Result" was kept rather than renamed to "Conclusion" because that is the
assignment's own section name, and it does more than a conclusion: it is
where the student's score is computed, their Digital Thinking Identity is
revealed, a printable identity card is generated, and the final written
reflection is captured — the directive's own "Conclusion" phase
description ("summarize learning outcomes and encourage reflection") is
fully satisfied by this section's `final` page, it's just not the section's
literal name.

## 2. Learning objectives per section

| Section | Educational objective | Expected input | Feedback / completion state |
|---|---|---|---|
| Introduction | Establish the essential question ("When does technology help us think, and when does it start doing the thinking for us?") and ground it in Risko & Gilbert's (2016) cognitive offloading theory. | None (reading page). | N/A — always open. |
| Task | Make the deliverable explicit before starting: 3 checkpoints, 3 possible identities, "this is not graded on correctness." | None (reading page). | N/A — always open. |
| Process → Checkpoint 1 (Critical Thinking) | Practice evaluating an AI-generated answer rather than accepting it at face value: correctness, trust, and need to verify. | Pasted AI answer + 3 short judgments + a reflection (5 fields). | Deterministic sufficiency pre-check flags thin answers live, as the student types (not just after grading); LLM rubric score 1-3 with a one-sentence "why." |
| Process → Checkpoint 2 (Memory) | Make the act of "offloading to a device" and "using your own memory" directly comparable, using a real memory-strengthening mechanic (retrieval practice). | A timed recall of 10 presented facts, free text. | Deterministic keyword-match score 1-3 against the 10 real facts; a "trap" reflection explicitly ties the activity back to the facts just tested. |
| Process → Checkpoint 3 (Problem-Solving) | Make the *order of operations* (think first, then consult AI, vs. ask AI first) a felt experience, not just a claim. | A two-round write-up: unaided solution, AI-assisted solution, and a comparison (5 fields). | Same deterministic pre-check + LLM rubric as Checkpoint 1. |
| Result | Turn the three raw 1-3 scores into one legible identity and a printable artifact; require the student to articulate, in their own words, what they'll keep doing with technology's help vs. on their own. | Final written reflection (`fin.learned`, `fin.changed`) + 2 short identity-card explanations (`card.helps`, `card.replaces`) + a self-named "strongest thinking skill." | Identity badge + 3-skill score breakdown + a deterministic "challenge" prompt tied to the resulting identity. |
| Evaluation | Transparent grading-criteria explanation — what is and isn't graded, and how the 1-9 score maps to meaning rather than a letter grade. | None (reading page). | N/A — always open. |
| Meet the Team | Attribution/context — who built this and for what course. | None (reading page). | N/A — always open. Bio text fields are present and ready to be filled in once written (see `docs/design-system.md` note — out of scope for this pass to author the bios themselves). |
| Resources | Point to the 5 real academic sources the activities are built on (Risko & Gilbert 2016; Sparrow, Liu & Wegner 2011; Parasuraman & Riley 1997; Kapur 2008; Ward et al. 2017), each linked directly. | None (reading page). | N/A — always open. |

## 3. Activities explicitly named in the directive, mapped to what exists

| Directive's suggested activity | Closest existing equivalent |
|---|---|
| "Digital Habits Explorer" | Checkpoint 2 (Memory) + the Task page's up-front habit framing — the memory challenge *is* the digital-habits exploration (retrieval vs. offloading), not a separate activity. |
| "Attention Challenge" | Checkpoint 2's timed, no-scroll-back recall under time pressure functions as an attention/focus challenge in addition to a memory one. |
| "Think Before You Click" | Checkpoint 1 (Critical Thinking) — pause-and-verify an AI answer before accepting it, which is exactly this concept. |
| "Personal Digital Action Plan" | The Result section's identity card fields (`card.helps` / `card.replaces` / `card.rules`) — "where technology helps," "where it replaces," and "my three rules" is a personal action plan in miniature. |

**These were not built as four additional, separate activities** — doing
so would have meant inventing new assessment content without academic
sign-off, which the directive explicitly warns against ("do not invent
scientific scoring thresholds or assessment validity claims" /
"preserve approved academic content"). The three existing checkpoints
already cover this ground; expanding to literally-named new activities is
flagged here for instructor decision, not silently done.

## 4. Gating / sequencing logic (reference)

`FREE = { intro, task, process, resources, evaluation, team: true }` —
these six are always open. The three checkpoints and the Result section's
four pages are gated in document order: a page can only be entered once
every page before it (in `STEPS` order) that has a gate (`gateAt()`)
satisfies it. See `docs/scoring-methodology.md` for what satisfies each
gate.
