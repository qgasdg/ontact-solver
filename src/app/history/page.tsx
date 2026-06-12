"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Problem {
  id: string;
  imageUrl: string;
  explanation: string;
  createdAt: string;
}

function imgSrc(url: string) {
  return url.startsWith("/") ? url : `/api/image?url=${encodeURIComponent(url)}`;
}

export default function HistoryPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/problems").then((r) => r.json());
      setProblems(data);
    } catch {
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin";
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 문제를 삭제할까요? 이미지도 함께 삭제됩니다.")) return;
    await fetch("/api/problems", {
      method: "DELETE",
      body: JSON.stringify({ id }),
      headers: { "Content-Type": "application/json" },
    });
    setProblems((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-800">풀이 히스토리</h1>
          <div className="flex gap-3">
            <Link
              href="/image"
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              문제 이미지 →
            </Link>
            <Link
              href="/solution"
              className="text-sm bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors"
            >
              풀이 보기 →
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-600 px-2 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">불러오는 중...</div>
        ) : problems.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <div className="text-5xl mb-4">📭</div>
            <p>아직 풀이 기록이 없습니다</p>
            <p className="text-sm mt-2">
              <Link href="/image" className="text-indigo-500 hover:underline">
                /image
              </Link>
              {" 에서 문제를 올려보세요"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {problems.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc(p.imageUrl)}
                    alt="문제"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400">
                      {new Date(p.createdAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none transition-colors"
                      title="삭제"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/${p.id}/image`}
                      target="_blank"
                      className="flex-1 text-center text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-lg transition-colors"
                    >
                      이미지
                    </Link>
                    <Link
                      href={`/${p.id}/gpt`}
                      target="_blank"
                      className="flex-1 text-center text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 py-1.5 rounded-lg transition-colors"
                    >
                      풀이
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
