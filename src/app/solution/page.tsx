"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface CurrentProblem {
  id: string;
  imageUrl: string;
  subject: string;
  explanation: string;
  createdAt: string;
  status: "solving" | "done";
}

function normalizeLatex(text: string): string {
  return text
    .replace(/\\\[/g, "$$").replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$").replace(/\\\)/g, "$");
}

export default function SolutionPage() {
  const [current, setCurrent] = useState<CurrentProblem | null>(null);
  const [solving, setSolving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/current", { cache: "no-store" });
        const data: CurrentProblem | null = await res.json();
        if (data && (data.id !== lastIdRef.current || data.status !== current?.status)) {
          lastIdRef.current = data.id;
          setCurrent(data);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [current?.status]);

  const handleFile = useCallback(async (f: File) => {
    setSolving(true);
    try {
      const form = new FormData();
      form.append("image", f);
      const res = await fetch("/api/solve-current", { method: "POST", body: form });
      if (!res.ok) throw new Error();

      const r = res.body!.getReader();
      while (true) {
        const { done } = await r.read();
        if (done) break;
      }

      const updated: CurrentProblem | null = await fetch("/api/current", { cache: "no-store" }).then((r) => r.json());
      if (updated) {
        lastIdRef.current = updated.id;
        setCurrent(updated);
      }
    } catch {
      // keep existing state
    } finally {
      setSolving(false);
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((i) => i.kind === "file" && i.type.startsWith("image/"));
      if (imageItem) {
        const f = imageItem.getAsFile();
        if (f) handleFile(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const isSolving = solving || current?.status === "solving";

  return (
    <div
      className={`min-h-screen bg-white flex flex-col transition-colors ${dragging ? "bg-indigo-50" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f?.type.startsWith("image/")) handleFile(f);
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          {isSolving && (
            <span className="text-xs text-amber-500 animate-pulse">GPT 풀이 생성 중...</span>
          )}
          {current?.status === "done" && !solving && (
            <span className="text-xs text-green-500">풀이 완료</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a href="/history" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← 히스토리</a>
          <label className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer underline underline-offset-2">
            사진 업로드
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
            />
          </label>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-8">
        {!current && !isSolving ? (
          <div
            className="h-full flex flex-col items-center justify-center cursor-pointer min-h-64"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center select-none">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-lg text-gray-400 mb-2">풀이가 여기에 나타납니다</p>
              <p className="text-sm text-gray-300">사진을 붙여넣거나 업로드하면 GPT가 풀이를 생성해요</p>
            </div>
          </div>
        ) : isSolving ? (
          <div className="flex flex-col items-center justify-center min-h-64">
            <div className="text-4xl mb-4 animate-bounce">🤔</div>
            <p className="text-gray-500 animate-pulse">GPT가 풀이를 생성하고 있습니다...</p>
          </div>
        ) : current?.explanation ? (
          <div className="max-w-3xl mx-auto">
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {normalizeLatex(current.explanation)}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
