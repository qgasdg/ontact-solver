import { put, del } from "@vercel/blob";
import { kv } from "@vercel/kv";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export interface Problem {
  id: string;
  imageUrl: string;
  explanation: string;
  createdAt: string;
}

export interface CurrentProblem {
  id: string;
  imageUrl: string;
  explanation: string;
  createdAt: string;
  status: "solving" | "done";
}

// ---------------------------------------------------------------------------
// Backend selection
//   KV_REST_API_URL set  → Vercel KV  (production / preview)
//   otherwise            → local filesystem  (local dev without KV)
// ---------------------------------------------------------------------------
const isProd = process.env.NODE_ENV === "production";
export const useKV = isProd && !!process.env.KV_REST_API_URL;
export const useBlob = isProd && !!process.env.BLOB_READ_WRITE_TOKEN;

// Local paths
const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const PROBLEMS_FILE = path.join(DATA_DIR, "problems.json");
const CURRENT_FILE = path.join(DATA_DIR, "current.json");

async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(UPLOADS_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------

export async function getProblems(): Promise<Problem[]> {
  if (useKV) return (await kv.get<Problem[]>("problems")) ?? [];
  try {
    return JSON.parse(await readFile(PROBLEMS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export async function saveProblem(problem: Problem): Promise<void> {
  const problems = await getProblems();
  problems.unshift(problem);
  if (useKV) {
    await kv.set("problems", problems);
  } else {
    await ensureDirs();
    await writeFile(PROBLEMS_FILE, JSON.stringify(problems, null, 2));
  }
}

export async function getProblemById(id: string): Promise<Problem | undefined> {
  return (await getProblems()).find((p) => p.id === id);
}

export async function deleteProblem(id: string): Promise<void> {
  const all = await getProblems();
  const target = all.find((p) => p.id === id);
  const problems = all.filter((p) => p.id !== id);
  if (useKV) {
    await kv.set("problems", problems);
  } else {
    await writeFile(PROBLEMS_FILE, JSON.stringify(problems, null, 2));
  }
  if (target?.imageUrl) await deleteImage(target.imageUrl);
}

// ---------------------------------------------------------------------------
// Current problem (real-time state)
// ---------------------------------------------------------------------------

export async function getCurrentProblem(): Promise<CurrentProblem | null> {
  if (useKV) return kv.get<CurrentProblem>("current");
  try {
    return JSON.parse(await readFile(CURRENT_FILE, "utf-8"));
  } catch {
    return null;
  }
}

export async function setCurrentProblem(problem: CurrentProblem): Promise<void> {
  if (useKV) {
    await kv.set("current", problem);
  } else {
    await ensureDirs();
    await writeFile(CURRENT_FILE, JSON.stringify(problem));
  }
}

// ---------------------------------------------------------------------------
// Image upload (always Vercel Blob in production, local otherwise)
// ---------------------------------------------------------------------------

export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    if (imageUrl.startsWith("/uploads/")) {
      // path.basename guards against traversal in a stored URL
      await unlink(path.join(UPLOADS_DIR, path.basename(imageUrl)));
    } else if (useBlob) {
      await del(imageUrl);
    }
  } catch {
    // Best-effort: a missing file/blob shouldn't block record deletion
  }
}

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  if (useBlob) {
    const blob = await put(filename, buffer, { access: "private", contentType });
    return blob.url;
  }
  await ensureDirs();
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
