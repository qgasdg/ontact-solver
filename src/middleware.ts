import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";

// These paths are always public (no auth required)
const PUBLIC_PATHS = ["/admin", "/api/admin/login", "/api/admin/logout"];

// Token: "<expiry>.<hex sig>" — sig = HMAC-SHA256(secret:password, expiry).
// Mirrors signToken in /api/admin/login (this runs on the Edge runtime, so WebCrypto).
async function signExpiry(expiresAt: string, password: string): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? "ontact-default-salt";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(`${secret}:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(expiresAt));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

async function isValidSession(cookie: string, password: string): Promise<boolean> {
  const dot = cookie.indexOf(".");
  if (dot === -1) return false;
  const expiresAt = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) < Date.now()) return false;
  const expected = await signExpiry(expiresAt, password);
  return constantTimeEqual(sig, expected);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    // Local dev (next dev) skips auth; in production a missing password fails closed
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Server misconfigured: ADMIN_PASSWORD is not set", { status: 503 });
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value ?? "";
  const authed = await isValidSession(cookie, adminPassword);

  if (!authed) {
    // API 요청은 401, 페이지 요청은 /admin으로 리다이렉트
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
