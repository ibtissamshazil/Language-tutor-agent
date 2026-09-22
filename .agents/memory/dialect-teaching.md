---
name: Teaching a spoken dialect
description: Why a dialect variant needs its own prompt brief in the language registry, and what the brief must cover to stop the model drifting back to the standard language.
---

# Teaching a spoken dialect

A dialect variant (Damascene Arabic next to MSA, and any future case like
Egyptian or Cantonese) must carry a long-form brief in the language registry,
injected into the system prompt as its own section directly under the intro.
Do not express it by lengthening the short script note — that note is
interpolated inline inside several other sentences, so it has to stay a
fragment.

**Why:** a one-line "teach the colloquial form, not the standard one" steers the
first reply and then decays. Models fall back to the prestige/standard variety
mid-conversation because that is what their training data rewards, and a learner
cannot tell the difference — which makes it the worst kind of failure, silent
and confidently wrong.

**What the brief has to contain**, in rough order of payoff:
- An explicit FORBIDDEN list naming the standard-variety and neighbouring-dialect
  forms, with the correct local form beside each. Negative examples do more work
  than positive description.
- The grammatical particles that mark the dialect (tense/aspect markers, negation,
  question words, demonstratives, pronouns) — these leak first.
- Everyday adjectives and social formulas. A model reaches for the standard
  adjective set unless the local one is spelled out, and picks words that are
  real in the standard language but wrong in the dialect (e.g. an MSA word for
  "interesting" offered as "beautiful").
- An orthography rule: write the dialect in the standard script with etymological
  spelling, and put the actual pronunciation only in the transliteration. Also
  ban chat-alphabet numerals, and fix ONE transliteration convention — otherwise
  the same word is romanized differently in consecutive replies.

**How to apply:** verify with live chats, not by reading the prompt. Ask for
sentences that tempt the standard form ("I am going to X now", "this is very
beautiful") and check the aspect marker, the demonstrative, and the adjective.
