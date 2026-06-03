import { getCurrentProblem } from "@/lib/storage";

export async function GET() {
  const problem = await getCurrentProblem();
  return Response.json(problem);
}
