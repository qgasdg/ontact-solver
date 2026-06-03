import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(UPLOADS_DIR, { recursive: true });
}

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

const PROBLEMS_FILE = path.join(DATA_DIR, "problems.json");
const CURRENT_FILE = path.join(DATA_DIR, "current.json");

export async function getProblems(): Promise<Problem[]> {
  try {
    const data = await readFile(PROBLEMS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveProblem(problem: Problem): Promise<void> {
  await ensureDirs();
  const problems = await getProblems();
  problems.unshift(problem);
  await writeFile(PROBLEMS_FILE, JSON.stringify(problems, null, 2));
}

export async function getProblemById(id: string): Promise<Problem | undefined> {
  const problems = await getProblems();
  return problems.find((p) => p.id === id);
}

export async function deleteProblem(id: string): Promise<void> {
  const problems = await getProblems();
  await writeFile(PROBLEMS_FILE, JSON.stringify(problems.filter((p) => p.id !== id), null, 2));
}

export async function getCurrentProblem(): Promise<CurrentProblem | null> {
  try {
    const data = await readFile(CURRENT_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function setCurrentProblem(problem: CurrentProblem): Promise<void> {
  await ensureDirs();
  await writeFile(CURRENT_FILE, JSON.stringify(problem));
}
