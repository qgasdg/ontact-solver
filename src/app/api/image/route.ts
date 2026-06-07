import { NextRequest } from "next/server";

// Allow both private (*.blob.vercel-storage.com)
// and public (*.public.blob.vercel-storage.com) blob URLs
const ALLOWED_HOSTNAME = /^[a-zA-Z0-9_-]+(\.public|\.private)?\.blob\.vercel-storage\.com$/;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTNAME.test(parsed.hostname)) {
    return new Response("Forbidden", { status: 403 });
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });

  if (!res.ok) return new Response("Not found", { status: 404 });

  const contentType = res.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
