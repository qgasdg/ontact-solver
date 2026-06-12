import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { kv } from "@vercel/kv";
import { useKV } from "@/lib/storage";

const COOKIE_NAME = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Token: "<expiry>.<hex sig>" where sig = HMAC-SHA256(secret:password, expiry).
// Including the password in the key means changing it invalidates all sessions.
function signToken(expiresAt: number, password: string): string {
  const secret = process.env.SESSION_SECRET ?? "ontact-default-salt";
  const sig = createHmac("sha256", `${secret}:${password}`)
    .update(String(expiresAt))
    .digest("hex");
  return `${expiresAt}.${sig}`;
}

// 분당 5회 제한 (KV 환경에서만)
async function checkRateLimit(ip: string): Promise<boolean> {
  if (!useKV) return true;
  const minute = Math.floor(Date.now() / 60000);
  const key = `rate:login:${ip}:${minute}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, 120);
  return count <= 5;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json(
      { error: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword) {
    return NextResponse.json({ error: "서버에 ADMIN_PASSWORD가 설정되지 않았습니다." }, { status: 500 });
  }

  let valid = false;
  try {
    valid =
      password.length === adminPassword.length &&
      timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword));
  } catch {
    valid = false;
  }

  if (!valid) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  const expiresAt = Date.now() + MAX_AGE * 1000;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, signToken(expiresAt, adminPassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MAX_AGE,
    path: "/",
  });
  return res;
}
