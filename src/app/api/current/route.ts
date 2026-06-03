import { getCurrentProblem } from "@/lib/storage";

export async function GET() {
  const problem = await getCurrentProblem();
  return Response.json(problem, {
    headers: {
      // Vercel CDN이 2초간 캐시 → 학생 30명이 폴링해도 KV 읽기는 2초당 1번
      "Cache-Control": "s-maxage=2, stale-while-revalidate=1",
    },
  });
}
