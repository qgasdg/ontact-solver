import { NextRequest, NextResponse } from "next/server";
import { getProblems, deleteProblem } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(await getProblems());
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await deleteProblem(id);
  return NextResponse.json({ ok: true });
}
