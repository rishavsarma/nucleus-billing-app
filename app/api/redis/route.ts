// app/api/redis-test/route.ts — delete this once you've confirmed it works
import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

export async function GET() {
  await redis.set("app:test", "hello");
  const value = await redis.get("app:test");
  await redis.del("app:test");
  return NextResponse.json({ value });
}