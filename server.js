// Custom Next.js server — required for PM2 cluster mode to actually work.
//
// Why this file exists: `pm2-runtime -i max next start` does NOT cluster
// correctly. PM2's cluster mode is built around forking a Node.js *module*
// it can `require()`/`import()` internally (via node:cluster) — not around
// wrapping an arbitrary CLI command. Pointing PM2 at the `next start` CLI
// directly caused every worker to crash-loop with "unknown option '-i'",
// because PM2's own `-i max` flag was leaking into the wrapped command's
// argument parsing instead of being consumed by PM2 itself.
//
// This file is a genuine Node entry point using Next.js's documented
// programmatic server API (https://nextjs.org/docs/app/guides/custom-server).
// PM2 can fork *this* correctly — each cluster worker runs this same file,
// and node:cluster's built-in port-sharing (which PM2 relies on) transparently
// distributes incoming connections across workers bound to the same port.
// Middleware, i18n routing, API routes, etc. are unaffected — a custom
// server is a thin wrapper around the exact same request-handling pipeline
// `next start` uses internally, not a reimplementation of it.
//
// Usage: `pm2-runtime -i max server.js` (not `next start`).

import { createServer } from "node:http"
import { parse } from "node:url"
import next from "next"

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME || "0.0.0.0"
const port = parseInt(process.env.PORT || "3000", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        console.error("Error occurred handling", req.url, err)
        res.statusCode = 500
        res.end("internal server error")
      }
    })
      .once("error", (err) => {
        console.error(err)
        process.exit(1)
      })
      .listen(port, () => {
        // node:cluster's worker id, when running under PM2/cluster mode —
        // undefined when run directly (e.g. local `bun run start`).
        const workerId = process.env.NODE_APP_INSTANCE ?? process.env.pm_id ?? "standalone"
        console.log(`> Ready on http://${hostname}:${port} (worker: ${workerId})`)
      })
  })
  .catch((err) => {
    console.error("Failed to start server:", err)
    process.exit(1)
  })
