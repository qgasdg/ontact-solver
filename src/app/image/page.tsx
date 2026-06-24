"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface CurrentProblem {
  id: string;
  imageUrl: string;
  status: "solving" | "done";
  studentName?: string;
  questionNumber?: number;
}

async function logout() {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/admin";
}

export default function ImagePage() {
  const [current, setCurrent] = useState<CurrentProblem | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [solving, setSolving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [studentName, setStudentName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastIdRef = useRef<string | null>(null);

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
    setErrorMsg("");
    try {
      const form = new FormData();
      form.append("image", f);
      form.append("studentName", studentName);
      const res = await fetch("/api/solve-current", { method: "POST", body: form });
      if (res.status === 401) { window.location.href = "/admin"; return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "업로드에 실패했습니다.");
      }

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
      setLocalPreview(null);
    } catch (err) {
      // keep local preview on error
      setErrorMsg(err instanceof Error && err.message ? err.message : "오류가 발생했습니다.");
    } finally {
      setSolving(false);
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
          {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
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
          <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">로그아웃</button>
        </div>
      </div>

      {/* Content */}
      {displaySrc ? (
        <div className="flex flex-col flex-1 px-8 pt-8 pb-0">
          <div className="flex justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displaySrc}
              alt="문제 이미지"
              className="max-w-3xl w-full max-h-[38vh] object-contain rounded-lg border border-gray-100"
            />
          </div>
          <div className="flex-1 max-w-3xl mx-auto w-full border-t border-gray-100" />
        </div>
      ) : (
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
