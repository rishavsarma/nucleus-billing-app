import "server-only"
import http2 from "node:http2"

/**
 * A `fetch`-compatible function backed by Bun/Node's `node:http2` client,
 * for injecting into `createServerClient`/`createClient` via
 * `global: { fetch: http2Fetch }` — see lib/supabase/server.ts and
 * lib/supabase/admin.ts, the only two call sites. Never wire this into
 * lib/supabase/client.ts (browser — the browser's own fetch already
 * negotiates HTTP/2 natively) or lib/supabase/proxy.ts (used exclusively
 * from proxy.ts middleware, which runs on the Edge runtime — `node:http2`
 * doesn't exist there and importing it would crash every request).
 *
 * Why this exists: Bun's own `fetch()` only ever speaks HTTP/1.1, even
 * against a server (our self-hosted Supabase/Kong) that fully supports
 * HTTP/2 over TLS via ALPN — confirmed empirically (BUN_CONFIG_VERBOSE_FETCH
 * logs "HTTP/1.1" for every call) as of Bun 1.4.2, and Bun's own release
 * notes only ever describe HTTP/2 for `Bun.serve()` (server-side), never
 * for client `fetch()`. `node:http2`'s client, on the other hand, does
 * negotiate real HTTP/2 against the same endpoint and — because a session
 * is reused across requests instead of TLS-handshaking every time — was
 * measured at a consistent ~25ms/request after the first connection vs.
 * `fetch()`'s noisier 30-150ms swings.
 *
 * Design:
 * - One persistent HTTP/2 session per origin, shared across every request
 *   that process makes to that origin (module-level singleton map) — not
 *   per-request. Under PM2 cluster mode each worker keeps its own session,
 *   which is still one handshake per worker instead of one per request.
 * - The session is dropped and a fresh one is opened on the next request
 *   after 'error'/'close'/'goaway' — reconnection is transparent to callers.
 * - Any failure anywhere in the HTTP/2 path (connection error, malformed
 *   response, an unsupported body type we don't bother handling) falls
 *   back to the real global `fetch()` for that one call, never throws past
 *   this module and never hangs — this can only make things faster, never
 *   less correct, since worst case is identical to not having this shim.
 */

const sessions = new Map<string, http2.ClientHttp2Session>()

// Regular HTTP/2 header fields these forbid (connection-specific headers
// have no meaning in HTTP/2 — sending them can get the whole request
// rejected by a strict peer) — https://http2.github.io/http2-spec/#not
const FORBIDDEN_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "http2-settings",
  "host", // HTTP/2 uses the :authority pseudo-header instead
])

// Statuses the Fetch spec forbids a body on — constructing `new Response`
// with a non-null body for one of these throws.
const NULL_BODY_STATUSES = new Set([204, 205, 304])

function getSession(origin: string): http2.ClientHttp2Session {
  const existing = sessions.get(origin)
  if (existing && !existing.destroyed && !existing.closed) return existing

  const session = http2.connect(origin)
  // Requests may be added faster than Node's default listener-count
  // warning threshold under real concurrency; this is a legitimate shared
  // resource, not a leak.
  session.setMaxListeners(0)
  const drop = () => {
    if (sessions.get(origin) === session) sessions.delete(origin)
  }
  session.on("error", drop)
  session.on("close", drop)
  // GOAWAY means the peer won't accept new streams on this session (idle
  // shutdown, restart, etc.) — existing in-flight streams still finish
  // normally; we just stop handing this session out for new requests.
  session.on("goaway", drop)
  sessions.set(origin, session)
  return session
}

function toPlainHeaders(
  headersInit: HeadersInit | undefined
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headersInit) return out
  const headers =
    headersInit instanceof Headers ? headersInit : new Headers(headersInit)
  headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (FORBIDDEN_HEADERS.has(lower)) return
    out[lower] = value
  })
  return out
}

/** Returns the body ready to hand to `req.end()`, or `undefined` to signal
 * "not a body shape this shim handles — fall back to native fetch" (a
 * ReadableStream or Blob request body, neither of which supabase-js /
 * postgrest-js / gotrue-js ever actually send — they JSON.stringify). */
function normalizeBody(
  body: BodyInit | null | undefined
): Buffer | string | null | undefined {
  if (body == null) return null
  if (typeof body === "string") return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (body instanceof URLSearchParams) return body.toString()
  return undefined
}

async function http2FetchAttempt(
  input: string | URL | Request,
  init: RequestInit
): Promise<Response> {
  let url: URL
  let method = init.method
  let headersInit: HeadersInit | undefined = init.headers
  let bodyInit: BodyInit | null | undefined = init.body
  let signal = init.signal ?? undefined

  if (input instanceof Request) {
    url = new URL(input.url)
    method = method ?? input.method
    headersInit = headersInit ?? input.headers
    bodyInit = bodyInit ?? (input.body as BodyInit | null)
    signal = signal ?? input.signal
  } else {
    url = new URL(input.toString())
  }
  method = (method ?? "GET").toUpperCase()

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return globalThis.fetch(input as RequestInfo, init)
  }

  const body = normalizeBody(bodyInit)
  if (body === undefined) {
    return globalThis.fetch(input as RequestInfo, init)
  }

  const session = getSession(url.origin)

  return new Promise<Response>((resolve, reject) => {
    const plainHeaders = toPlainHeaders(headersInit)
    if (body != null) {
      plainHeaders["content-length"] = String(Buffer.byteLength(body))
    }

    const reqHeaders: http2.OutgoingHttpHeaders = {
      [http2.constants.HTTP2_HEADER_METHOD]: method,
      [http2.constants.HTTP2_HEADER_PATH]: url.pathname + url.search,
      ...plainHeaders,
    }

    let req: http2.ClientHttp2Stream
    try {
      req = session.request(reqHeaders)
    } catch (err) {
      reject(err)
      return
    }

    // Every listener below must be attached before any abort check can
    // possibly return — an http2 stream's 'error' event throws as an
    // uncaught exception when nothing is listening for it, so an
    // already-aborted signal returning early *before* req.on("error", ...)
    // is registered would crash the process on the connection's own
    // eventual error instead of just settling this promise.
    let settled = false
    const onAbort = () => {
      if (settled) return
      settled = true
      req.close(http2.constants.NGHTTP2_CANCEL)
      reject(new DOMException("The operation was aborted.", "AbortError"))
    }

    let responseHeaders: http2.IncomingHttpHeaders = {}
    const chunks: Buffer[] = []

    req.on("response", (hdrs) => {
      responseHeaders = hdrs
    })
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => {
      if (settled) return
      settled = true
      signal?.removeEventListener("abort", onAbort)
      try {
        const status = Number(
          responseHeaders[http2.constants.HTTP2_HEADER_STATUS] ?? 200
        )
        const headerEntries: [string, string][] = Object.entries(
          responseHeaders
        )
          .filter(([key]) => !key.startsWith(":"))
          .map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(", ") : String(value ?? ""),
          ])
        const bodyBuffer = Buffer.concat(chunks)
        const responseBody = NULL_BODY_STATUSES.has(status) ? null : bodyBuffer
        resolve(new Response(responseBody, { status, headers: headerEntries }))
      } catch (err) {
        reject(err)
      }
    })
    req.on("error", (err) => {
      if (settled) return
      settled = true
      signal?.removeEventListener("abort", onAbort)
      reject(err)
    })

    // Safe now that every listener above is attached — an already-aborted
    // signal settles the promise via onAbort, and the stream's later
    // 'error' event (from the close() call) lands on the handler above,
    // which is a no-op once settled is true.
    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener("abort", onAbort, { once: true })
    }

    if (body != null) req.end(body)
    else req.end()
  })
}

/**
 * Drop-in `fetch` replacement. See the module doc comment above for the
 * full rationale and design. Any failure in the HTTP/2 path (including an
 * unsupported body shape) transparently falls back to the real `fetch()`
 * for that call — a genuine `AbortError` is the one exception, since
 * masking a real cancellation as a retry would be wrong, not just slower.
 */
export async function http2Fetch(
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> {
  try {
    return await http2FetchAttempt(input, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err
    return globalThis.fetch(input as RequestInfo, init)
  }
}
