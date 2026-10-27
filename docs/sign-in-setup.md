# Self-hosted sign-in setup

Authentication, account ownership, code verification, password hashes and sessions
live in this app and its PostgreSQL database. There is no Auth0 dependency or
authentication-service subscription.

For the initial email-OTP launch, only the SMTP settings below are required.
Google setup can be completed later. The sign-in screen hides Google until it
is configured and does not offer an active email-send button without SMTP
configuration. Password sign-in remains available under the alternate methods.

## Email codes

Supply these server-side settings using the project's secure Secrets form:

- `SMTP_HOST`: your existing email provider's SMTP server.
- `SMTP_PORT`: `465` (implicit TLS, default) or `587` (STARTTLS).
- `SMTP_USER`: the mailbox login.
- `SMTP_PASSWORD`: an SMTP-specific/app password, not a password entered into chat.
- `SMTP_FROM`: the sender address authorized by that provider.

`SESSION_SECRET` is already used as a server-only key for the code HMAC. It must
remain private. Rotating it invalidates outstanding email codes.

An existing Gmail mailbox can use `smtp.gmail.com`, port `465`, and an app password
where the account supports app passwords. Other standard SMTP services work too.
Provider sending limits and eligibility still apply; the app cannot provide
unlimited free email delivery itself. Do not use the development email sender
addresses of a commercial provider to claim delivery to arbitrary recipients.

## Google sign-in

In Google Cloud / Google Auth Platform:

1. Configure the consent screen for your app and its audience.
2. Create an OAuth client of type **Web application**.
3. Set the authorized redirect URI to
   `https://YOUR-ACTUAL-APP-HOST/api/auth/google/callback`.
4. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `AUTH_PUBLIC_ORIGIN` through
   the secure configuration UI. The origin is only
   `https://YOUR-ACTUAL-APP-HOST` with no path/query.
5. If the consent app is in testing mode, add the intended testers. Configure
   public access in Google when ready for other users.

Use the actual development preview host for testing. Publishing is separate:
before deploying, obtain the actual published URL, add its exact redirect URI in
Google, and configure the production origin. Never infer a published URL from a
workspace name.

No Google OAuth credentials are bundled into the browser. The app uses a
server-side authorization-code exchange, PKCE, a same-browser state cookie,
one-use stored state, a nonce, and Google's ID-token signature/audience/expiry
verification. It requests only `openid email`.

## Account behavior

- Email-code sign-in also creates an account if that email is new.
- Password sign-in is under **Sign in using another method**.
- While verifying an email code, users can optionally set/replace a password.
  Replacing it revokes other sessions.
- Password-only registrations made before email proof are marked unverified.
  The first verified email/Google sign-in removes any unverified password and
  revokes old sessions to prevent pre-registration takeover. Users can set a new
  password using a verified email code.
- A verified Google identity links only through a verified Google email or its
  previously linked subject. Historical ownerless chats are never claimed.
- Missing sender or Google configuration fails explicitly with a 503 response.
  Codes are never returned by API, displayed in the app, or logged as a shortcut.

## Verification

### Ingress and rate-limit boundaries

Express trusts only loopback proxy addresses. A preview ingress probe confirmed
the direct peer is loopback and that caller-supplied `X-Forwarded-For` is replaced.
Do not set `trust proxy` to `true` or blindly trust all private addresses.
Traversal stops at the nearest untrusted hop; in a multi-proxy installation
that hop may itself be a shared ingress. Credential budgets are therefore scoped
to both that address and the submitted email/challenge, not to the shared address
alone. Invalid-input spam cannot consume another account's sign-in budget.
OAuth initiation has a separate per-browser budget, since no email exists yet.
Code-guess limits and email-send cooldown/hourly limits are independently stored
in PostgreSQL and cannot be bypassed by changing forwarded headers.

Run `pnpm --filter @workspace/api-server test:accounts`. It creates and destroys
an isolated PostgreSQL database and uses test-only delivery and identity doubles;
it does not send real mail or contact Google. The account/session/privacy tests
remain included. Live SMTP delivery and Google consent must be checked after the
owner supplies configuration. Run `pnpm typecheck` for workspace typechecking.
