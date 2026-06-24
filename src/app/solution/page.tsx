"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface CurrentProblem {
  id: string;
  imageUrl: string;
  explanation: string;
  createdAt: string;
  status: "solving" | "done";
  studentName?: string;
  questionNumber?: number;
}

async function logout() {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/admin";
}

function normalizeLatex(text: string): string {
  return text
    .replace(/\\\[/g, "$$").replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$").replace(/\\\)/g, "$");
}

export default function SolutionPage() {
  const [current, setCurrent] = useState<CurrentProblem | null>(null);
  const [solving, setSolving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [studentName, setStudentName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 이 탭에서 직접 스트리밍 중이면 폴링이 더 짧은 부분 풀이로 덮어쓰지 않도록
  const solvingRef = useRef(false);

  useEffect(() => {
    const poll = async () => {
      if (solvingRef.current) return;
      try {
        const res = await fetch("/api/current", { cache: "no-store" });
        const data: CurrentProblem | null = await res.json();
        if (!data) return;
        setCurrent((prev) =>
          !prev ||
          prev.id !== data.id ||
          prev.status !== data.status ||
          prev.explanation !== data.explanation
            ? data
            : prev
        );
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setSolving(true);
    solvingRef.current = true;
    setErrorMsg("");
    try {
      const form = new FormData();
      form.append("image", f);
      form.append("studentName", studentName);
      const res = await fetch("/api/solve-current", { method: "POST", body: form });
      if (res.status === 401) { window.location.href = "/admin"; return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "풀이 생성에 실패했습니다.");
      }

      // 첫 줄은 메타 JSON, 이후는 풀이 텍스트 스트림 → 실시간 렌더링
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let meta: Omit<CurrentProblem, "explanation" | "status"> | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        if (!meta) {
          const nl = buf.indexOf("\n");
          if (nl === -1) continue;
          meta = JSON.parse(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
        }
        if (meta) setCurrent({ ...meta, explanation: buf, status: "solving" });
      }
      if (meta) setCurrent({ ...meta, explanation: buf, status: "done" });
    } catch (err) {
      setErrorMsg(err instanceof Error && err.message ? err.message : "오류가 발생했습니다.");
    } finally {
      setSolving(false);
      solvingRef.current = false;
    }
  }, [studentName]);

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

  const [copyState, setCopyState] = useState<"idle" | "loading" | "done">("idle");

  const handleCopy = useCallback(async () => {
    if (!current?.imageUrl || !current?.explanation || copyState !== "idle") return;
    setCopyState("loading");
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: current.imageUrl }),
      });
      if (!res.ok) throw new Error("transcribe API 실패");
      const { transcription } = await res.json();
      const context = `아래 문제와 GPT의 해설이 있고 내가 이해가지 않는 부분이 있어.\n\n## 문제\n${transcription}\n\n## GPT 해설\n${current.explanation}`;

      // navigator.clipboard 우선, 실패 시 execCommand 폴백
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(context);
          copied = true;
        } catch {}
      }
      if (!copied) {
        const ta = document.createElement("textarea");
        ta.value = context;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      }
      if (!copied) throw new Error("클립보드 복사 실패");

      setCopyState("done");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "복사에 실패했습니다.");
      setCopyState("idle");
      setTimeout(() => setErrorMsg(""), 3000);
    }
  }, [current, copyState]);

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
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="학생 이름"
            className="text-sm border border-gray-200 rounded-md px-2 py-1 w-32 focus:outline-none focus:border-indigo-300"
          />
          {current?.studentName && (
            <span className="text-sm font-medium text-indigo-600">
              {current.studentName}
              {current.questionNumber != null && <span className="ml-1 text-gray-400 font-normal">#{current.questionNumber}번</span>}
            </span>
          )}
          {isSolving && (
            <span className="text-xs text-amber-500 animate-pulse">GPT 풀이 생성 중...</span>
          )}
          {current?.status === "done" && !solving && !errorMsg && (
            <span className="text-xs text-green-500">풀이 완료</span>
          )}
          {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
        </div>
        <div className="flex items-center gap-3">
          {current?.status === "done" && current.explanation && (
            <button
              onClick={handleCopy}
              disabled={copyState !== "idle"}
              className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors disabled:opacity-50"
            >
              {copyState === "loading" ? "전사 중..." : copyState === "done" ? "복사됨!" : "GPT에 복사"}
            </button>
          )}
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
          <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">로그아웃</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-8">
        {current?.explanation ? (
          <div className="max-w-3xl mx-auto">
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {normalizeLatex(current.explanation)}
              </ReactMarkdown>
            </div>
          </div>
        ) : !current && !isSolving ? (
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
        ) : null}
      </div>
    </div>
  );
}
