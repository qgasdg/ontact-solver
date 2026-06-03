import { NextResponse } from "next/server";
import { getProblemById } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = await getProblemById(id);
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(problem);
}
