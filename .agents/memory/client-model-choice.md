---
name: Client-chosen model is spend
description: Why a model slug coming from the browser has to be validated server-side against the free catalogue.
---

# A model slug from the client is a spending decision

The chosen model arrives from browser localStorage and is forwarded upstream
under the server's own API key. An unvalidated slug therefore lets any caller
name an expensive paid model and spend the account's credits.

**Rule:** validate the requested slug against the live free catalogue before
using it, and drop (do not reject) anything unknown — the tutor still works on
the automatic chain. When the catalogue cannot be fetched, fail CLOSED to the
curated chain rather than trusting the request.

"Free" means every priced dimension is zero, not just prompt and completion
tokens: a model can be free per token and still bill per request or per image,
and the catalogue gains new price fields over time. Treat an unrecognised
price field as billable.

**Why:** the model picker exists to offer free models only; the same list has
to double as the server-side allow-list, which is why retired or newly-paid
slugs must not be re-added to it for display purposes.

**How to apply:** whenever the picker, the catalogue filter, or the send path's
model handling changes.
