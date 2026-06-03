import { NextRequest, NextResponse } from "next/server";
import { getProblems, deleteProblem } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(await getProblems());
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await deleteProblem(id);
  return NextResponse.json({ ok: true });
}
