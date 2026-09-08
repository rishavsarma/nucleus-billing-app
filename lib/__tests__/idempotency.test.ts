jest.mock("@/lib/redis", () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}))

import { redis } from "@/lib/redis"
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
  releaseIdempotentRequest,
} from "@/lib/idempotency"

const mockRedis = redis as unknown as {
  set: jest.Mock
  get: jest.Mock
  del: jest.Mock
}

describe("beginIdempotentRequest", () => {
  it("proceeds without touching Redis when no key is supplied", async () => {
    const result = await beginIdempotentRequest("org-1", "payments", null)
    expect(result).toEqual({ outcome: "proceed" })
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it("proceeds and claims the key when it's genuinely new (SET NX succeeds)", async () => {
    mockRedis.set.mockResolvedValue("OK")

    const result = await beginIdempotentRequest("org-1", "payments", "key-abc")

    expect(result).toEqual({ outcome: "proceed" })
    expect(mockRedis.set).toHaveBeenCalledWith(
      "idempotency:payments:org-1:key-abc",
      JSON.stringify({ status: "pending" }),
      "EX",
      30,
      "NX"
    )
  })

  it("reports in_progress when the same key is already claimed and still pending", async () => {
    mockRedis.set.mockResolvedValue(null) // NX lost the race — key already exists
    mockRedis.get.mockResolvedValue(JSON.stringify({ status: "pending" }))

    const result = await beginIdempotentRequest("org-1", "payments", "key-abc")

    expect(result).toEqual({ outcome: "in_progress" })
  })

  it("replays the stored response when the same key already completed", async () => {
    mockRedis.set.mockResolvedValue(null)
    const storedBody = { id: "pay_1", amount: 500 }
    mockRedis.get.mockResolvedValue(
      JSON.stringify({ status: "done", httpStatus: 201, body: storedBody })
    )

    const result = await beginIdempotentRequest("org-1", "payments", "key-abc")

    expect(result).toEqual({
      outcome: "replay",
      httpStatus: 201,
      body: storedBody,
    })
  })

  it("scopes the Redis key by org and route so the same client key from a different org never collides", async () => {
    mockRedis.set.mockResolvedValue("OK")

    await beginIdempotentRequest("org-A", "purchase_payments", "same-key")
    await beginIdempotentRequest("org-B", "purchase_payments", "same-key")

    expect(mockRedis.set).toHaveBeenNthCalledWith(
      1,
      "idempotency:purchase_payments:org-A:same-key",
      expect.any(String),
      "EX",
      30,
      "NX"
    )
    expect(mockRedis.set).toHaveBeenNthCalledWith(
      2,
      "idempotency:purchase_payments:org-B:same-key",
      expect.any(String),
      "EX",
      30,
      "NX"
    )
  })

  it("fails OPEN (proceeds) when Redis errors — an idempotency-store outage must never block a real payment", async () => {
    mockRedis.set.mockRejectedValue(new Error("connection refused"))

    const result = await beginIdempotentRequest("org-1", "payments", "key-abc")

    expect(result).toEqual({ outcome: "proceed" })
  })
})

describe("completeIdempotentRequest", () => {
  it("stores the response with the long result TTL", async () => {
    mockRedis.set.mockResolvedValue("OK")

    await completeIdempotentRequest("org-1", "payments", "key-abc", 201, {
      id: "pay_1",
    })

    expect(mockRedis.set).toHaveBeenCalledWith(
      "idempotency:payments:org-1:key-abc",
      JSON.stringify({
        status: "done",
        httpStatus: 201,
        body: { id: "pay_1" },
      }),
      "EX",
      24 * 60 * 60
    )
  })

  it("is a no-op when no key was supplied", async () => {
    await completeIdempotentRequest("org-1", "payments", null, 201, {})
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it("never throws even if the Redis write fails", async () => {
    mockRedis.set.mockRejectedValue(new Error("timeout"))
    await expect(
      completeIdempotentRequest("org-1", "payments", "key-abc", 201, {})
    ).resolves.toBeUndefined()
  })
})

describe("releaseIdempotentRequest", () => {
  it("deletes the claimed key so a corrected retry isn't stuck replaying in_progress", async () => {
    mockRedis.del.mockResolvedValue(1)
    await releaseIdempotentRequest("org-1", "payments", "key-abc")
    expect(mockRedis.del).toHaveBeenCalledWith(
      "idempotency:payments:org-1:key-abc"
    )
  })

  it("is a no-op when no key was supplied", async () => {
    await releaseIdempotentRequest("org-1", "payments", null)
    expect(mockRedis.del).not.toHaveBeenCalled()
  })
})
