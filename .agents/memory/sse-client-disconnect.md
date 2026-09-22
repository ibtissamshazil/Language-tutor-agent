---
name: SSE client disconnect
description: How to detect that an SSE client went away in the Express chat route, and why the obvious listener does not work.
---

# Detecting a disconnected SSE client

Attach the disconnect listener to the **response**, not the request:

```
res.on("close", () => { if (!res.writableEnded) abortController.abort(); });
```

**Why:** on current Node, `IncomingMessage` "close" signals that the REQUEST
stream finished or was destroyed. For a POST the body has already been consumed
by the time a streaming handler starts, so a `req.on("close", ...)` listener
registered there either fires immediately or never fires for a real disconnect.
The consequence is silent and expensive: the upstream LLM generation keeps
running (and, with a model fallback chain, can walk every candidate) for a
response nobody is reading, then persists it.

The `!res.writableEnded` guard matters: "close" also fires on a normal completed
stream, and without the guard a finished response looks like a drop.

**How to apply:** any long-running streamed response (SSE, chunked proxying)
that ties an `AbortController` to client liveness.
