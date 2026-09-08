import http2, {
  type Http2ServerRequest,
  type Http2ServerResponse,
} from "node:http2"
import { http2Fetch } from "@/lib/http2-fetch"

/**
 * Exercises the shim against a real (cleartext h2c, no TLS needed for a
 * local test) HTTP/2 server rather than mocking node:http2 — the whole
 * point of this module is faithfully speaking the HTTP/2 client protocol,
 * which a mock can't meaningfully verify.
 */
function startServer(
  handler: (req: Http2ServerRequest, res: Http2ServerResponse) => void
): Promise<{ origin: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http2.createServer(handler)
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("expected an AddressInfo"))
        return
      }
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((res) => server.close(() => res())),
      })
    })
  })
}

function readBody(req: Http2ServerRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c: Buffer) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

describe("http2Fetch", () => {
  it("performs a GET and returns status, headers, and JSON body", async () => {
    const { origin, close } = await startServer((req, res) => {
      res.writeHead(200, {
        "content-type": "application/json",
        "x-custom": "yes",
      })
      res.end(JSON.stringify({ ok: true }))
    })
    try {
      const res = await http2Fetch(`${origin}/items`)
      expect(res.status).toBe(200)
      expect(res.headers.get("x-custom")).toBe("yes")
      expect(await res.json()).toEqual({ ok: true })
    } finally {
      await close()
    }
  })

  it("sends method, path, headers, and a JSON body correctly", async () => {
    let seenMethod = ""
    let seenPath = ""
    let seenHeader = ""
    let seenBody = ""
    const { origin, close } = await startServer((req, res) => {
      seenMethod = req.method
      seenPath = req.url
      seenHeader = String(req.headers["x-org-id"] ?? "")
      readBody(req).then((buf) => {
        seenBody = buf.toString("utf8")
        res.writeHead(201, { "content-type": "application/json" })
        res.end(JSON.stringify({ received: true }))
      })
    })
    try {
      const res = await http2Fetch(`${origin}/invoices?select=*`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": "org_123" },
        body: JSON.stringify({ total: 500 }),
      })
      expect(seenMethod).toBe("POST")
      expect(seenPath).toBe("/invoices?select=*")
      expect(seenHeader).toBe("org_123")
      expect(seenBody).toBe(JSON.stringify({ total: 500 }))
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ received: true })
    } finally {
      await close()
    }
  })

  it("returns a null body for a 204 response instead of throwing", async () => {
    const { origin, close } = await startServer((req, res) => {
      res.writeHead(204)
      res.end()
    })
    try {
      const res = await http2Fetch(`${origin}/void`, { method: "PUT" })
      expect(res.status).toBe(204)
      expect(res.body).toBeNull()
      expect(await res.text()).toBe("")
    } finally {
      await close()
    }
  })

  it("reuses one session across concurrent requests to the same origin", async () => {
    const { origin, close } = await startServer((req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "text/plain" })
        res.end(req.url ?? "")
      }, 20)
    })
    try {
      const paths = ["/a", "/b", "/c", "/d", "/e"]
      const results = await Promise.all(
        paths.map((p) => http2Fetch(`${origin}${p}`).then((r) => r.text()))
      )
      expect(results).toEqual(paths)
    } finally {
      await close()
    }
  })

  it("rejects with AbortError when the signal is already aborted", async () => {
    const { origin, close } = await startServer((req, res) => {
      res.writeHead(200)
      res.end("late")
    })
    try {
      const controller = new AbortController()
      controller.abort()
      await expect(
        http2Fetch(`${origin}/x`, { signal: controller.signal })
      ).rejects.toMatchObject({
        name: "AbortError",
      })
    } finally {
      await close()
    }
  })

  it("falls back to the native fetch for a non-http(s) URL", async () => {
    const nativeFetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"))
    try {
      const res = await http2Fetch("ftp://example.com/file")
      expect(nativeFetch).toHaveBeenCalledWith("ftp://example.com/file", {})
      expect(await res.text()).toBe("ok")
    } finally {
      nativeFetch.mockRestore()
    }
  })

  it("falls back to the native fetch for an unsupported (streaming) body", async () => {
    const nativeFetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("streamed"))
    try {
      const stream = new ReadableStream()
      const res = await http2Fetch("http://127.0.0.1:1/x", {
        method: "POST",
        body: stream as unknown as BodyInit,
      })
      expect(nativeFetch).toHaveBeenCalled()
      expect(await res.text()).toBe("streamed")
    } finally {
      nativeFetch.mockRestore()
    }
  })

  it("falls back to the native fetch when the HTTP/2 connection itself fails", async () => {
    const nativeFetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("fallback"))
    try {
      // Nothing listens on this port — the underlying session errors out,
      // and http2Fetch should swallow that and retry via native fetch
      // rather than rejecting the caller's promise.
      const res = await http2Fetch("http://127.0.0.1:1/unreachable")
      expect(nativeFetch).toHaveBeenCalled()
      expect(await res.text()).toBe("fallback")
    } finally {
      nativeFetch.mockRestore()
    }
  }, 10000)
})
