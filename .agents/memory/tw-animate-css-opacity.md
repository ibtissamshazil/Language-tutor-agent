---
name: tw-animate-css enter animations
description: Why pairing animate-in with a static opacity-0 class hides content permanently.
---
In projects using `tw-animate-css` (the `animate-in fade-in slide-in-from-* zoom-in-*` utilities), the enter animation does NOT apply `animation-fill-mode: forwards/both` by default.

**Rule:** Do not add a static `opacity-0` utility alongside `animate-in fade-in`. The `fade-in` already animates opacity from 0. With a static `opacity-0`, once the animation isn't filling (before the delay starts, or after it ends), the element reverts to opacity 0 and is invisible — content silently disappears.

**Why:** Observed lesson pages rendering blank section headers/cards. The h2 with no opacity-0 showed; sibling elements with `opacity-0 animate-in` did not. tailwindcss-animate behaves similarly.

**How to apply:** Use `animate-in fade-in ...` alone, OR if you need the element to hold its end state across a delay, set `style={{ animationFillMode: "both" }}` inline (and still avoid the static `opacity-0`).
