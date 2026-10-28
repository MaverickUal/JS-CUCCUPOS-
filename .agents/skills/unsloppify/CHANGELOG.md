# Changelog

## 1.4.1 - 2026-10-23

`scripts/scan.sh` creates its temp file under `TMPDIR`. Without a directory
in the template, macOS `mktemp` uses its per-user temp folder and ignores
`TMPDIR`, so the scan failed in sandboxes that allow writes only there.

## 1.4.0 - 2026-08-17

Catch improvised hyphen compounds while drafting.
The 1.3.0 release notes demonstrated the gap: "clause-final",
"comma-spliced", "flat-register", and "bare-comma" passed the drafting scan
because the compound class lived only in `references/patterns.md`, which
loads for full audits alone.

- `SKILL.md`: mode 3 bans improvised hyphen compounds ("review-shaped
  output", "genuine-need escape hatch") where plain words spell the idea
  out. Escape: established compounds the audience shares (thread-local,
  copy-on-write) and literal code identifiers. Several compounds in one
  paragraph fail even when each would pass alone. Drafting ends with a
  hyphen sweep of the draft, since the tell is frequent enough to earn its
  own pass.
- `references/patterns.md`: the Compressed noun compounds entry gains the
  density rule, new specimens, and the identifier escape, and says to assume
  a draft contains several until a hyphen search clears it.
- `baseline/CLAUDE-baseline.md`: the coinage bullet names the frequency and
  says to check every hyphenated modifier.
- `references/phrases.txt`: a triage group for chains of three or more
  hyphenated words and for the compound heads -shaped, -aware, -centric,
  -facing, -native, -grade.
- The 1.3.0 wording is spelled out across `SKILL.md`,
  `references/patterns.md`, `baseline/CLAUDE-baseline.md` (v1.3), and case
  17: the catalogue entry is now "Negation tails and comma splices".
- `tests/cases/18-docs-hyphen-compounds.md`: a cluster of five compounds,
  with thread-local staying as an established term.

## 1.3.0 - 2026-08-17

Catch clause-final negation tails.

- `references/patterns.md`: new Manufactured drama entry for negation and
  comma-spliced tails: comma tails that state the fact by excluding its
  alternative (", not X.", ", no X either.") and bare-comma splices that omit
  the connective. The escape is a contrast that preempts a misreading the
  positive statement leaves open ("per host, not per request").
- `references/phrases.txt`: a triage group for clause-final ", not X",
  ", no/never X", ", nothing else", and sentence-final "either". Comma
  splices stay in the model pass.
- `SKILL.md`: mode 2's test and ban list cover facts stated by denying the
  alternative. The code-comments context gains two rules: state what the code
  does, and join clauses with the real connective.
- `baseline/CLAUDE-baseline.md` (v1.2): the negation bullet names
  clause-final tails.
- `tests/cases/17-comment-negation-tails.md`: two tails, a splice, and a
  legitimate contrast.

## 1.2.0 - 2026-07-17

Narrow the trigger to text deliverables. A Codex session loaded the skill for
a file-download task because its chat commentary counted as "text others will
read".

- `SKILL.md`: the description states when to load (text artifact is the
  deliverable or a major part of one) and when not to (chat replies, status
  updates, completion summaries around a non-text task). New "When to load"
  section with the same rule and an exit for a skill loaded in error.
- `baseline/CLAUDE-baseline.md` (v1.1): the closing line names the qualifying
  artifacts and routes conversational text to the baseline instead of the
  skill.

## 1.1.0 - 2026-07-16

Catch dramatic absolutes.

- `references/phrases.txt`: scanner patterns for dramatic "cannot", "never", and "always" constructions (cannot afford to, simply cannot, can't go wrong, there is no other way, there can be no doubt, never be the same, cannot be understated, stakes and crossroads variants), drawn from mastra's AbsoluteAssertions and UrgencyInflation lists.
- `references/phrases.txt`: a broad-triage group surfaces bare `cannot`, `never`, `gate`, `actually`, `land`, `ship`, and `sits`, with the rule that most hits are legitimate and each takes a per-instance test named in the group comment.
- `references/phrases.txt`: the list grows from 380 to 649 patterns via a full mastra ai-tells inventory, covering figurative verbs (lands silently, falls short, holds water, casts doubt, lends credence), affirmative formulas, anthropomorphic justification, hedges, narrative pivots, opening and closing cliches, transitions, filler, vague attributions, and vocabulary tells (leverage, robust, pivotal). Capitalization-dependent mastra rules stay in the model pass because the scanner matches case-insensitively.
- `references/patterns.md`: the Absolute overreach entry names the bare-absolute class, "cannot"/"never"/"always" where plain "not" states the fact, and notes it needs the model pass.
- `SKILL.md`: mode 1 bans dramatic absolutes, with a literal impossibility as the escape.
- `tests/cases/16-docs-dramatic-absolutes.md`: case covering both the scanner constructions and the bare form.

## 1.0.0 - 2026-07-16

Restructure into two tiers.

- `baseline/CLAUDE-baseline.md`: an always-on block to paste into a global CLAUDE.md or AGENTS.md.
- `SKILL.md` rewritten around six failure modes, each with a test, a ban list, an escape clause, and a rewrite example, plus per-context rules and an audit procedure.
- `references/patterns.md`: 76 entries grouped by failure mode, replaces `references/tropes.md`.
- `scripts/scan.sh` and `references/phrases.txt`: a deterministic scan against 380 phrase patterns, works with ripgrep or grep.
- `tests/`: 15 manual cases with expected findings.

Versions before 1.0.0 were unversioned drafts.
