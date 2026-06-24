import { NextRequest } from "next/server";
import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";
import { UPLOADS_DIR } from "@/lib/storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ALLOWED_BLOB = /^[a-zA-Z0-9_-]+(\.public|\.private)?\.blob\.vercel-storage\.com$/;

function mimeFromExt(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const imageUrl = body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    return Response.json({ error: "imageUrl이 필요합니다." }, { status: 400 });
  }

  let base64: string;
  let mimeType: string;

  if (imageUrl.startsWith("/uploads/")) {
    const filename = path.basename(imageUrl);
    const buffer = await readFile(path.join(UPLOADS_DIR, filename));
    base64 = buffer.toString("base64");
    mimeType = mimeFromExt(filename);
  } else {
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return Response.json({ error: "유효하지 않은 URL입니다." }, { status: 400 });
    }
    if (parsed.protocol !== "https:" || !ALLOWED_BLOB.test(parsed.hostname)) {
      return Response.json({ error: "허용되지 않은 URL입니다." }, { status: 403 });
    }
    const res = await fetch(imageUrl, {
      headers: process.env.BLOB_READ_WRITE_TOKEN
        ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        : {},
    });
    if (!res.ok) return Response.json({ error: "이미지를 불러올 수 없습니다." }, { status: 404 });
    const contentType = res.headers.get("Content-Type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return Response.json({ error: "이미지가 아닙니다." }, { status: 403 });
    }
    mimeType = contentType.split(";")[0].trim();
    base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "이 문제 이미지의 내용을 텍스트로 정확하게 전사해줘. 수식은 LaTeX 문법($...$ 또는 $$...$$)으로 표현하고, 문제 번호·보기·조건 등 모든 내용을 빠짐없이 포함해줘. 설명이나 해설은 넣지 말고 문제 내용만 전사해줘.",
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    max_tokens: 1024,
  });

  const transcription = completion.choices[0]?.message?.content ?? "";
  return Response.json({ transcription });
}
