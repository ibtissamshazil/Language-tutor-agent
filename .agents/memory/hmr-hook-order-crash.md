---
name: Vite Fast Refresh hook-order crash
description: A React "Should have a queue / change in the order of Hooks" crash right after editing a custom hook is usually stale hot-reload state, not a bug.
---

# "Should have a queue" after editing a custom hook

Adding or removing a hook inside a custom hook module (or a component) while
the page is open makes Vite Fast Refresh re-render the existing component with
a new hook sequence. React then throws "Should have a queue. You are likely
calling Hooks conditionally" or "change in the order of Hooks called by X",
and the error frame points at an ordinary unconditional `useState` in the
consuming component — which is misleading.

**Rule:** before debugging such a crash, reload the page. If a fresh load is
clean and every hook in the component and its custom hooks is unconditional,
there is nothing to fix in the code.

**Why:** the reported location is the first hook whose slot changed, not the
cause, so it invites rewriting correct components.

**How to apply:** any runtime-error report that arrives immediately after a
hot update to a hooks file; check the log timestamps against the edit.
