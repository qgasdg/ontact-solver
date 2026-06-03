import { notFound } from "next/navigation";
import Link from "next/link";
import { getProblemById } from "@/lib/storage";

export default async function ImagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = await getProblemById(id);
  if (!problem) notFound();

  const imgSrc = problem.imageUrl.startsWith("/")
    ? problem.imageUrl
    : `/api/image?url=${encodeURIComponent(problem.imageUrl)}`;

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex items-center justify-end px-6 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex gap-4">
          <Link href="/history" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← 히스토리
          </Link>
          <Link href={`/${id}/gpt`} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            풀이 보기 →
          </Link>
        </div>
      </div>
      <div className="flex flex-col flex-1 px-8 pt-8 pb-0">
        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt="문제 이미지"
            className="max-w-3xl w-full max-h-[38vh] object-contain rounded-lg border border-gray-100"
          />
        </div>
        <div className="flex-1 max-w-3xl mx-auto w-full border-t border-gray-100" />
      </div>
    </div>
  );
}
