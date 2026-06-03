"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const SUBJECTS = ["수학", "국어", "영어", "과학", "사회", "역사", "물리", "화학", "생물", "지구과학", "기타"];

interface CurrentProblem {
  id: string;
  imageUrl: string;
  subject: string;
  status: "solving" | "done";
}

export default function ImagePage() {
  const [current, setCurrent] = useState<CurrentProblem | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [subject, setSubject] = useState("수학");
  const [solving, setSolving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastIdRef = useRef<string | null>(null);

  // Poll for current problem
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/current", { cache: "no-store" });
        const data: CurrentProblem | null = await res.json();
        if (data && data.id !== lastIdRef.current) {
          lastIdRef.current = data.id;
          setCurrent(data);
          if (!solving) setLocalPreview(null);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [solving]);

  const handleFile = useCallback(async (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setLocalPreview(e.target?.result as string);
    reader.readAsDataURL(f);

    setSolving(true);
    try {
      const form = new FormData();
      form.append("image", f);
      form.append("subject", subject);
      const res = await fetch("/api/solve-current", { method: "POST", body: form });
      if (!res.ok) throw new Error();

      // Drain stream — server saves result when done
      const r = res.body!.getReader();
      while (true) {
        const { done } = await r.read();
        if (done) break;
      }

      // Fetch updated state
      const updated: CurrentProblem | null = await fetch("/api/current", { cache: "no-store" }).then((r) => r.json());
      if (updated) {
        lastIdRef.current = updated.id;
        setCurrent(updated);
      }
      setLocalPreview(null);
    } catch {
      // keep local preview on error
    } finally {
      setSolving(false);
    }
  }, [subject]);

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

  const toSrc = (url: string) =>
    url.startsWith("/") ? url : `/api/image?url=${encodeURIComponent(url)}`;

  const displaySrc = localPreview
    ? localPreview
    : current
    ? toSrc(current.imageUrl)
    : null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          {(current || localPreview) && (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full">
              {current?.subject ?? subject}
            </span>
          )}
          {solving && (
            <span className="text-xs text-amber-500 animate-pulse">GPT 풀이 생성 중...</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a href="/history" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← 히스토리</a>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none"
          >
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
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
      {displaySrc ? (
        <div className="flex flex-col flex-1 px-8 pt-8 pb-0">
          {/* Problem image */}
          <div className="flex justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displaySrc}
              alt="문제 이미지"
              className="max-w-3xl w-full max-h-[38vh] object-contain rounded-lg border border-gray-100"
            />
          </div>
          {/* Whitespace for teacher writing */}
          <div className="flex-1 max-w-3xl mx-auto w-full border-t border-gray-100" />
        </div>
      ) : (
        /* Upload prompt */
        <div
          className={`flex-1 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragging ? "bg-indigo-50" : "bg-white"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f?.type.startsWith("image/")) handleFile(f);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-center select-none">
            <div className="text-6xl mb-5">📷</div>
            <p className="text-xl text-gray-400 mb-2">문제 사진을 붙여넣거나 업로드하세요</p>
            <p className="text-sm text-gray-300">Ctrl+V · 드래그앤드롭 · 클릭</p>
          </div>
        </div>
      )}
    </div>
  );
}
