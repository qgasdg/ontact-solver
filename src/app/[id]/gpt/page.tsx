import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { getProblemById } from "@/lib/storage";

function normalizeLatex(text: string): string {
  return text
    .replace(/\\\[/g, "$$").replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$").replace(/\\\)/g, "$");
}

export default async function GptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = await getProblemById(id);
  if (!problem) notFound();

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex items-center justify-end px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex gap-4">
          <Link href="/history" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← 히스토리
          </Link>
          <Link href={`/${id}/image`} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            문제 보기 →
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="prose prose-sm max-w-none text-gray-700">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {normalizeLatex(problem.explanation)}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
