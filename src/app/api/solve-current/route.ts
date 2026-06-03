import { NextRequest } from "next/server";
import OpenAI from "openai";
import { writeFile } from "fs/promises";
import { put } from "@vercel/blob";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { setCurrentProblem, saveProblem, UPLOADS_DIR } from "@/lib/storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;
    const subject = (formData.get("subject") as string) || "기타";

    if (!file) return Response.json({ error: "이미지가 없습니다." }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const rawExt = (file.name.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "jpg";
    const filename = `${uuidv4()}.${rawExt}`;

    let imageUrl: string;
    if (useBlob) {
      // Vercel Blob — public so images can be served without a proxy
      const blob = await put(filename, buffer, {
        access: "public",
        contentType: file.type || "image/jpeg",
      });
      imageUrl = blob.url;
    } else {
      // Local dev — save to public/uploads/
      await writeFile(path.join(UPLOADS_DIR, filename), buffer);
      imageUrl = `/uploads/${filename}`;
    }

    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";
    const problemId = uuidv4();
    const createdAt = new Date().toISOString();

    await setCurrentProblem({ id: problemId, imageUrl, subject, explanation: "", createdAt, status: "solving" });

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `이 문제의 해설을 작성해줘. 과목: ${subject}\n\n아래 형식으로 작성해:\n1. **문제 분석**: 문제가 묻는 것\n2. **풀이 과정**: 단계별 풀이\n3. **정답 및 핵심 개념**: 정답과 기억할 개념`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    let explanation = "";

    const readable = new ReadableStream({
      async start(controller) {
        const meta = JSON.stringify({ id: problemId, imageUrl, subject, createdAt }) + "\n";
        controller.enqueue(new TextEncoder().encode(meta));

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            explanation += delta;
            controller.enqueue(new TextEncoder().encode(delta));
          }
        }

        await Promise.all([
          setCurrentProblem({ id: problemId, imageUrl, subject, explanation, createdAt, status: "done" }),
          saveProblem({ id: problemId, imageUrl, subject, explanation, createdAt }),
        ]);
        controller.close();
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
