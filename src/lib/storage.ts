import { put, list } from "@vercel/blob";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export interface Problem {
  id: string;
  imageUrl: string;
  subject: string;
  explanation: string;
  createdAt: string;
}

export interface CurrentProblem {
  id: string;
  imageUrl: string;
  subject: string;
  explanation: string;
  createdAt: string;
  status: "solving" | "done";
}

// ---------------------------------------------------------------------------
// Backend selection: Vercel Blob when token is present, local fs otherwise
// ---------------------------------------------------------------------------

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

// Local paths (dev fallback)
const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const PROBLEMS_FILE = path.join(DATA_DIR, "problems.json");
const CURRENT_FILE = path.join(DATA_DIR, "current.json");

async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(UPLOADS_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Blob helpers
// ---------------------------------------------------------------------------

async function blobGet<T>(key: string): Promise<T | null> {
  try {
    const { blobs } = await list({ prefix: key });
    if (blobs.length === 0) return null;
    const res = await fetch(blobs[0].url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function blobPut(key: string, value: unknown) {
  await put(key, JSON.stringify(value), { access: "private", addRandomSuffix: false });
}

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------

export async function getProblems(): Promise<Problem[]> {
  if (useBlob) return (await blobGet<Problem[]>("problems.json")) ?? [];
  try {
    return JSON.parse(await readFile(PROBLEMS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export async function saveProblem(problem: Problem): Promise<void> {
  const problems = await getProblems();
  problems.unshift(problem);
  if (useBlob) {
    await blobPut("problems.json", problems);
  } else {
    await ensureDirs();
    await writeFile(PROBLEMS_FILE, JSON.stringify(problems, null, 2));
  }
}

export async function getProblemById(id: string): Promise<Problem | undefined> {
  return (await getProblems()).find((p) => p.id === id);
}

export async function deleteProblem(id: string): Promise<void> {
  const problems = (await getProblems()).filter((p) => p.id !== id);
  if (useBlob) {
    await blobPut("problems.json", problems);
  } else {
    await writeFile(PROBLEMS_FILE, JSON.stringify(problems, null, 2));
  }
}

// ---------------------------------------------------------------------------
// Current problem
// ---------------------------------------------------------------------------

export async function getCurrentProblem(): Promise<CurrentProblem | null> {
  if (useBlob) return blobGet<CurrentProblem>("current.json");
  try {
    return JSON.parse(await readFile(CURRENT_FILE, "utf-8"));
  } catch {
    return null;
  }
}

export async function setCurrentProblem(problem: CurrentProblem): Promise<void> {
  if (useBlob) {
    await blobPut("current.json", problem);
  } else {
    await ensureDirs();
    await writeFile(CURRENT_FILE, JSON.stringify(problem));
  }
}
