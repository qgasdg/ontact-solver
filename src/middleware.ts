import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";

// These paths are always public (no auth required)
const PUBLIC_PATHS = ["/admin", "/api/admin/login"];

// HMAC-SHA256(salt=SESSION_SECRET, data=password) → hex token
async function tokenFor(password: string): Promise<string> {
  const salt = process.env.SESSION_SECRET ?? "ontact-default-salt";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(password));
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const adminPassword = process.env.ADMIN_PASSWORD;
  // If ADMIN_PASSWORD is not set (local dev), skip auth
  if (!adminPassword) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value ?? "";
  const expected = await tokenFor(adminPassword);
  const authed = constantTimeEqual(cookie, expected);

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
