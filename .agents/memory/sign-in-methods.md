---
name: Sign-in methods
description: User-required default and alternative sign-in methods for Language Tutor.
---

Default sign-in should use an email address and a code sent to that email. Keep password sign-in available under “Sign in using another method.”

**Why:** The user explicitly requested this sign-in behavior.

**How to apply:** Use this requirement when implementing or revising the Language Tutor account screens and authentication flows.

Use the app's own login system, not Auth0 or a paid authentication service.
Google sign-in is also requested, but email OTP is the initial launch focus.

**Why:** The user rejected Auth0 and requested a free, self-hosted login system.

**How to apply:** Keep account/session ownership in this app. Email delivery and
Google OAuth require owner-supplied provider configuration; never present test
codes or nonfunctional controls as successful authentication.
