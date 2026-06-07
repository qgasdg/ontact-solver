import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";

const PROTECTED: Array<{ method: string; path: string }> = [
  { method: "POST", path: "/api/solve-current" },
  { method: "DELETE", path: "/api/problems" },
];

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
  const method = req.method;

  const isProtected = PROTECTED.some((r) => r.path === pathname && r.method === method);
  if (!isProtected) return NextResponse.next();

  const adminPassword = process.env.ADMIN_PASSWORD;
  // If ADMIN_PASSWORD is not set (local dev), skip auth
  if (!adminPassword) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value ?? "";
  const expected = await tokenFor(adminPassword);

  if (!constantTimeEqual(cookie, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/solve-current", "/api/problems"],
};
