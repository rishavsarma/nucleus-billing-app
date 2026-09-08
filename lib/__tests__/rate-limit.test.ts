// lib/rate-limit.ts imports the shared ioredis client from lib/redis.ts,
// which opens a real connection as a module-load side effect — mock it so
// these tests never touch the network and can assert exact call behavior.
jest.mock("@/lib/redis", () => ({
  redis: {
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
  },
}))

import { redis } from "@/lib/redis"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const mockRedis = redis as unknown as {
  incr: jest.Mock
  expire: jest.Mock
  ttl: jest.Mock
}

describe("checkRateLimit", () => {
  it("allows the first request in a window and sets an expiry", async () => {
    mockRedis.incr.mockResolvedValue(1)
    mockRedis.expire.mockResolvedValue(1)

    const result = await checkRateLimit("login-ip:1.2.3.4", 5, 900)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(mockRedis.incr).toHaveBeenCalledWith("ratelimit:login-ip:1.2.3.4")
    // Expiry is only set on the first hit of a window (count === 1) — a
    // later call must not keep resetting the window's clock.
    expect(mockRedis.expire).toHaveBeenCalledWith(
      "ratelimit:login-ip:1.2.3.4",
      900
    )
  })

  it("does not reset the expiry on subsequent requests within the window", async () => {
    mockRedis.incr.mockResolvedValue(3)

    await checkRateLimit("login-ip:1.2.3.4", 5, 900)

    expect(mockRedis.expire).not.toHaveBeenCalled()
  })

  it("allows requests up to and including the limit", async () => {
    mockRedis.incr.mockResolvedValue(5)

    const result = await checkRateLimit("login-email:a@b.com", 5, 900)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it("blocks once the count exceeds the limit, reporting retryAfterSeconds from the key's TTL", async () => {
    mockRedis.incr.mockResolvedValue(6)
    mockRedis.ttl.mockResolvedValue(120)

    const result = await checkRateLimit("login-email:a@b.com", 5, 900)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterSeconds).toBe(120)
  })

  it("falls back to the full window length when TTL comes back non-positive (e.g. key expired mid-check)", async () => {
    mockRedis.incr.mockResolvedValue(10)
    mockRedis.ttl.mockResolvedValue(-1)

    const result = await checkRateLimit("login-email:a@b.com", 5, 900)

    expect(result.retryAfterSeconds).toBe(900)
  })

  it("fails OPEN (allows the request) when Redis errors — a rate-limit outage must never lock everyone out", async () => {
    mockRedis.incr.mockRejectedValue(new Error("connection refused"))

    const result = await checkRateLimit("login-ip:1.2.3.4", 5, 900)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
  })
})

describe("getClientIp", () => {
  it("takes the first address from a comma-separated X-Forwarded-For chain", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" },
    })
    expect(getClientIp(request)).toBe("203.0.113.5")
  })

  it("falls back to X-Real-IP when X-Forwarded-For is absent", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-real-ip": "198.51.100.7" },
    })
    expect(getClientIp(request)).toBe("198.51.100.7")
  })

  it("falls back to a shared bucket rather than throwing when neither header is present", () => {
    const request = new Request("http://localhost/api/auth/login")
    expect(getClientIp(request)).toBe("unknown")
  })
})
