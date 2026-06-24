import { NextRequest } from "next/server";
import OpenAI from "openai";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import { setCurrentProblem, saveProblem, uploadImage, useKV, getNextQuestionNumber } from "@/lib/storage";

export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function isImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true; // PNG
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // GIF
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true; // WebP
  return false;
}

// 분당 5회 제한 (KV 환경에서만)
async function checkRateLimit(ip: string): Promise<boolean> {
  if (!useKV) return true;
  const minute = Math.floor(Date.now() / 60000);
  const key = `rate:solve:${ip}:${minute}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, 120);
  return count <= 5;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!await checkRateLimit(ip)) {
      return Response.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("image") as File;
    const studentName = ((formData.get("studentName") as string | null) ?? "").trim().slice(0, 50);

    if (!file) return Response.json({ error: "이미지가 없습니다." }, { status: 400 });

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!isImageBuffer(buffer)) {
      return Response.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    const rawExt = (file.name.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "jpg";
    const filename = `${uuidv4()}.${rawExt}`;

    const imageUrl = await uploadImage(buffer, filename, file.type || "image/jpeg");

    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";
    const problemId = uuidv4();
    const createdAt = new Date().toISOString();
    const questionNumber = await getNextQuestionNumber();

    await setCurrentProblem({ id: problemId, imageUrl, explanation: "", createdAt, status: "solving", studentName, questionNumber });

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `이 문제의 해설을 작성해줘.\n\n아래 형식으로 작성해:\n1. **문제 분석**: 문제가 묻는 것\n2. **풀이 과정**: 정답을 도출하는 전체 풀이 과정을 단계별로 빠짐없이 서술해줘\n3. **정답 및 핵심 개념**: 정답과 기억할 개념`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    let explanation = "";

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        // Keep consuming the OpenAI stream even if the uploader disconnects,
        // so the solution is still saved and polled clients keep streaming.
        let clientGone = false;
        const safeEnqueue = (text: string) => {
          if (clientGone) return;
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            clientGone = true;
          }
        };

        safeEnqueue(JSON.stringify({ id: problemId, imageUrl, createdAt, studentName, questionNumber }) + "\n");

        // 폴링 클라이언트도 부분 풀이를 볼 수 있게 주기적으로 KV 갱신
        let lastFlush = Date.now();

        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              explanation += delta;
              safeEnqueue(delta);
            }
            if (Date.now() - lastFlush > 1500) {
              lastFlush = Date.now();
              await setCurrentProblem({ id: problemId, imageUrl, explanation, createdAt, status: "solving" });
            }
          }
        } finally {
          await Promise.all([
            setCurrentProblem({ id: problemId, imageUrl, explanation, createdAt, status: "done", studentName, questionNumber }),
            saveProblem({ id: problemId, imageUrl, explanation, createdAt, studentName, questionNumber }),
          ]);
        }

        if (!clientGone) {
          try {
            controller.close();
          } catch {}
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
