/**
 * High-Performance Concurrent Load Tester for Nucleus Billing App
 * 
 * Usage:
 *   bun run scripts/load-test.ts [scenario] --cookie="sb-supabase-auth-token=..." [options]
 * 
 * Scenarios:
 *   mixed        (Default) Realistic mixed traffic (items, invoices, customers, tax rates)
 *   items        Catalog search & pagination across items
 *   invoices     Invoices list with customer data
 *   customers    Customer search queries
 *   url <path>   Test a specific endpoint (e.g. /api/database/warehouses)
 * 
 * Options:
 *   --cookie="<str>"       Auth cookie (e.g. sb-supabase-auth-token=...)
 *   -c, --connections=<n>  Number of concurrent simulated users (default: 25)
 *   -n, --requests=<n>     Total requests to issue (default: 1000)
 *   --host=<url>           Target host (default: http://localhost:3000)
 */

interface Config {
  target: string
  host: string
  cookie: string
  connections: number
  totalRequests: number
}

function parseArgs(): Config {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                   Nucleus API Multi-User Load Tester                       ║
╚════════════════════════════════════════════════════════════════════════════╝

Usage:
  bun run scripts/load-test.ts [scenario] --cookie="sb-supabase-auth-token=..." [options]

Scenarios:
  mixed        (Default) Realistic mixed traffic across items, invoices, customers
  items        Tests items catalog search & deep pagination
  invoices     Tests invoices list
  customers    Tests customers search
  url <path>   Tests a specific relative path (e.g. /api/database/warehouses)

Required:
  --cookie=<str>        Cookie value (e.g. sb-supabase-auth-token=...)

Options:
  -c, --connections=<n> Number of concurrent workers (default: 25)
  -n, --requests=<n>    Total requests to issue (default: 1000)
  --host=<url>          Base URL (default: http://localhost:3000)

Example:
  bun run scripts/load-test.ts mixed --cookie="sb-supabase-auth-token=..." -c 50 -n 1000
    `)
    process.exit(0)
  }

  let target = "mixed"
  let host = "http://localhost:3000"
  let cookie = ""
  let connections = 50
  let totalRequests = 200

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "mixed" || arg === "items" || arg === "invoices" || arg === "customers") {
      target = arg
    } else if (arg === "url") {
      target = args[++i]
    } else if (arg.startsWith("http://") || arg.startsWith("https://") || arg.startsWith("/api/")) {
      target = arg
    } else if (arg.startsWith("--cookie=")) {
      cookie = arg.split("=").slice(1).join("=").replace(/^["']|["']$/g, "")
    } else if (arg.startsWith("-c=") || arg.startsWith("--connections=")) {
      connections = parseInt(arg.split("=")[1], 10)
    } else if (arg === "-c" || arg === "--connections") {
      connections = parseInt(args[++i], 10)
    } else if (arg.startsWith("-n=") || arg.startsWith("--requests=")) {
      totalRequests = parseInt(arg.split("=")[1], 10)
    } else if (arg === "-n" || arg === "--requests") {
      totalRequests = parseInt(args[++i], 10)
    } else if (arg.startsWith("--host=")) {
      host = arg.split("=")[1]
    }
  }

  // Ensure cookie has name=value format
  if (cookie && !cookie.includes("=")) {
    cookie = `sb-supabase-auth-token=${cookie}`
  }

  return { target, host, cookie, connections, totalRequests }
}

function getRequestUrl(config: Config, reqIndex: number): string {
  const base = config.host.replace(/\/$/, "")

  if (config.target === "items") {
    const pages = [1, 2, 3, 5, 10]
    const searchTerms = ["", "Widget", "Sensor", "Pro", "Ultra", "Standard", "Cable"]
    const page = pages[reqIndex % pages.length]
    const search = searchTerms[reqIndex % searchTerms.length]
    return `${base}/api/database/items?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`
  }

  if (config.target === "invoices") {
    const pages = [1, 2, 3, 4, 5]
    const page = pages[reqIndex % pages.length]
    return `${base}/api/database/invoices?page=${page}&pageSize=15`
  }

  if (config.target === "customers") {
    const searches = ["", "Customer", "Enterprises", "Retail", "Tech", "Global"]
    const search = searches[reqIndex % searches.length]
    return `${base}/api/database/customers?search=${encodeURIComponent(search)}&page=1&pageSize=10`
  }

  if (config.target === "mixed") {
    const bucket = reqIndex % 10
    if (bucket < 4) {
      const terms = ["", "Widget", "Sensor", "Pro", "SKU"]
      return `${base}/api/database/items?page=${1 + (reqIndex % 4)}&pageSize=20&search=${encodeURIComponent(terms[reqIndex % terms.length])}`
    } else if (bucket < 7) {
      return `${base}/api/database/invoices?page=${1 + (reqIndex % 3)}&pageSize=15`
    } else if (bucket < 9) {
      return `${base}/api/database/customers?search=${encodeURIComponent(["Client", "Enterprises", "Retail"][reqIndex % 3])}&page=1&pageSize=10`
    } else {
      return `${base}/api/database/tax_rates?page=1&pageSize=10`
    }
  }

  if (config.target.startsWith("http")) return config.target
  return `${base}${config.target.startsWith("/") ? "" : "/"}${config.target}`
}

function calculatePercentile(latencies: number[], percentile: number): number {
  if (latencies.length === 0) return 0
  const index = Math.ceil((percentile / 100) * latencies.length) - 1
  return latencies[Math.max(0, Math.min(index, latencies.length - 1))]
}

async function run() {
  const config = parseArgs()

  console.log("\n========================================================")
  console.log("⚡ Nucleus Billing API Concurrent Load Test")
  console.log("========================================================")
  console.log(`Scenario / Target: ${config.target}`)
  console.log(`Base Host:         ${config.host}`)
  console.log(`Concurrent Users:  ${config.connections} concurrent connections`)
  console.log(`Total Requests:    ${config.totalRequests}`)
  console.log(`Cookie:            ${config.cookie ? config.cookie.slice(0, 35) + "..." : "⚠️ None (requests will 401)"}`)
  console.log("========================================================\n")

  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (config.cookie) {
    headers["Cookie"] = config.cookie
  }

  // --- Preflight Verification Check ---
  process.stdout.write("🔍 Running Preflight Auth Check... ")
  const preflightUrl = getRequestUrl(config, 0)
  try {
    const preflightRes = await fetch(preflightUrl, { method: "GET", headers })
    if (preflightRes.status === 401 || preflightRes.status === 403) {
      console.log(`\n\n❌ AUTHENTICATION FAILED (HTTP ${preflightRes.status})`)
      console.log("--------------------------------------------------------")
      console.log("The server rejected the provided cookie.")
      console.log("Please copy the fresh sb-supabase-auth-token from DevTools:")
      console.log('  bun run scripts/load-test.ts mixed --cookie="sb-supabase-auth-token=..."')
      console.log("--------------------------------------------------------\n")
      process.exit(1)
    }
    console.log(`✅ OK (HTTP ${preflightRes.status})\n`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`\n❌ Failed to connect to server at ${config.host}: ${message}`)
    console.log("Make sure your dev server is running (e.g. bun run dev).\n")
    process.exit(1)
  }

  const latencies: number[] = []
  const statusCodes: Record<number, number> = {}
  const sampleErrors: Array<{ url: string; status: number; body: string }> = []
  let errorCount = 0
  let completed = 0
  let currentIndex = 0

  const startTime = performance.now()

  async function worker() {
    while (currentIndex < config.totalRequests) {
      const idx = currentIndex++
      const url = getRequestUrl(config, idx)
      const reqStart = performance.now()

      try {
        const res = await fetch(url, {
          method: "GET",
          headers,
        })
        const duration = performance.now() - reqStart
        latencies.push(duration)
        statusCodes[res.status] = (statusCodes[res.status] || 0) + 1
        if (!res.ok) {
          errorCount++
          if (sampleErrors.length < 5) {
            const body = await res.text().catch(() => "")
            sampleErrors.push({ url, status: res.status, body: body.slice(0, 200) })
          }
        }
      } catch (err: unknown) {
        errorCount++
        statusCodes[0] = (statusCodes[0] || 0) + 1
        if (sampleErrors.length < 5) {
          sampleErrors.push({ url, status: 0, body: err instanceof Error ? err.message : String(err) })
        }
      } finally {
        completed++
        if (completed % Math.max(1, Math.floor(config.totalRequests / 20)) === 0 || completed === config.totalRequests) {
          const progress = Math.round((completed / config.totalRequests) * 100)
          const barLen = Math.floor(progress / 5)
          process.stdout.write(`\rProgress: [${"█".repeat(barLen)}${"-".repeat(20 - barLen)}] ${progress}% (${completed}/${config.totalRequests})`)
        }
      }
    }
  }

  // Launch concurrent workers
  await Promise.all(Array.from({ length: config.connections }, () => worker()))

  const totalTimeSec = (performance.now() - startTime) / 1000
  latencies.sort((a, b) => a - b)

  const rps = (completed / totalTimeSec).toFixed(1)
  const avg = (latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(1)
  const min = (latencies[0] || 0).toFixed(1)
  const max = (latencies[latencies.length - 1] || 0).toFixed(1)
  const p50 = calculatePercentile(latencies, 50).toFixed(1)
  const p75 = calculatePercentile(latencies, 75).toFixed(1)
  const p90 = calculatePercentile(latencies, 90).toFixed(1)
  const p95 = calculatePercentile(latencies, 95).toFixed(1)
  const p99 = calculatePercentile(latencies, 99).toFixed(1)

  console.log("\n\n📊 Load Test Results")
  console.log("========================================================")
  console.log(`Total Elapsed Time:  ${totalTimeSec.toFixed(2)}s`)
  console.log(`Total Requests:      ${completed}`)
  console.log(`Throughput:          ${rps} req/sec`)
  console.log(`Success Rate:        ${(((completed - errorCount) / completed) * 100).toFixed(2)}%`)
  console.log("--------------------------------------------------------")
  console.log("Latency Distribution (ms):")
  console.log(`  Min (fastest):     ${min} ms`)
  console.log(`  p50 (median):      ${p50} ms`)
  console.log(`  p75 (75th pct):    ${p75} ms`)
  console.log(`  p90 (90th pct):    ${p90} ms`)
  console.log(`  p95 (95th pct):    ${p95} ms`)
  console.log(`  p99 (worst 1%):    ${p99} ms`)
  console.log(`  Max (slowest):     ${max} ms`)
  console.log(`  Average:           ${avg} ms`)
  console.log("--------------------------------------------------------")
  console.log("HTTP Status Codes:")
  for (const [code, count] of Object.entries(statusCodes)) {
    const label = code === "0" ? "Network Failure / Timeout" : `HTTP ${code}`
    console.log(`  ${label}: ${count} (${((count / completed) * 100).toFixed(1)}%)`)
  }
  if (sampleErrors.length > 0) {
    console.log("--------------------------------------------------------")
    console.log("⚠️ Sample Error Responses:")
    sampleErrors.forEach((e, i) => {
      console.log(`  [${i + 1}] HTTP ${e.status} from ${e.url}`)
      console.log(`      Body: ${e.body}`)
    })
  }
  console.log("========================================================\n")
}

run().catch(console.error)
