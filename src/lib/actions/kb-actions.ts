"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { KbCategory } from "@/generated/prisma";
import { extractText, getDocumentProxy } from "unpdf";

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "to", "of", "in", "on",
  "for", "and", "or", "how", "what", "why", "when", "do", "does", "did", "it", "its",
  "not", "with", "at", "my", "i", "we", "our", "please", "help", "can", "should", "will",
  // ubiquitous across nearly every entry's title — low signal, would dilute matches
  "machine",
]);

/** Light stemming so "caps"/"cap" and "bodies"/"body" etc. still match. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && /(s|x|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem);
}

/**
 * Rule-based (not LLM-powered) keyword/token-overlap matcher. Weighs the
 * title and keywords fields higher than the free-text answer so an entry
 * whose keywords match the question ranks above one that merely mentions
 * the same word once in a long answer.
 */
function scoreEntry(questionTokens: string[], entry: { title: string; keywords: string; answer: string; cause: string | null }) {
  const titleTokens = new Set(tokenize(entry.title));
  const keywordTokens = new Set(
    entry.keywords
      .split(",")
      .flatMap((k) => tokenize(k))
  );
  const bodyTokens = new Set(tokenize(`${entry.cause ?? ""} ${entry.answer}`));

  let score = 0;
  for (const t of questionTokens) {
    if (titleTokens.has(t)) score += 3;
    if (keywordTokens.has(t)) score += 3;
    if (bodyTokens.has(t)) score += 1;
  }
  return score;
}

export type KbMatch = {
  id: string;
  kind: "kb" | "ingredient";
  category: string;
  title: string;
  cause: string | null;
  answer: string;
  source: string | null;
  score: number;
};

function ingredientKeywords(i: { alternateName: string | null; synonyms: string | null; aanValue: string | null; type: string; category: string | null }) {
  return [i.alternateName, i.synonyms, i.aanValue, i.type, i.category].filter(Boolean).join(", ");
}

function ensureFullStop(s: string) {
  return /[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`;
}

function ingredientAnswer(i: {
  name: string;
  synonyms: string | null;
  notes: string | null;
  verified: boolean;
  verificationSource: string | null;
  classification: string | null;
  chemicalName: string | null;
  casNumber: string | null;
  mainBenefit: string | null;
  usedFor: string | null;
  typicalDosage: string | null;
  storageConditions: string | null;
  safetyNotes: string | null;
  regulatoryStatus: string | null;
  tgaStatus: string | null;
  apvmaStatus: string | null;
  fdaStatus: string | null;
  emaStatus: string | null;
  aicisStatus: string | null;
}) {
  const sentences: string[] = [];
  if (i.synonyms) sentences.push(`Also known as ${i.synonyms}.`);
  if (i.notes) sentences.push(ensureFullStop(i.notes));
  if (i.mainBenefit) sentences.push(`Main benefit: ${ensureFullStop(i.mainBenefit)}`);
  if (i.usedFor) sentences.push(`Used for: ${ensureFullStop(i.usedFor)}`);
  if (i.chemicalName) sentences.push(`Chemical name: ${i.chemicalName}.`);
  if (i.casNumber) sentences.push(`CAS number: ${i.casNumber}.`);
  if (i.typicalDosage) sentences.push(`Typical dosage/use: ${ensureFullStop(i.typicalDosage)}`);
  const authorities = [
    i.tgaStatus && `TGA: ${i.tgaStatus}`,
    i.apvmaStatus && `APVMA: ${i.apvmaStatus}`,
    i.fdaStatus && `FDA: ${i.fdaStatus}`,
    i.emaStatus && `EMA: ${i.emaStatus}`,
    i.aicisStatus && `AICIS: ${i.aicisStatus}`,
  ].filter(Boolean);
  if (authorities.length > 0) sentences.push(`Regulatory status — ${authorities.join(", ")}.`);
  if (i.regulatoryStatus) sentences.push(`Regulatory summary: ${ensureFullStop(i.regulatoryStatus)}`);
  if (i.safetyNotes) sentences.push(`Safety & handling: ${ensureFullStop(i.safetyNotes)}`);
  if (i.storageConditions) sentences.push(`Storage: ${ensureFullStop(i.storageConditions)}`);

  if (sentences.length === 0) {
    return i.verified
      ? `${i.name} is verified, but no detail fields have been populated yet.`
      : `${i.name} has not yet been verified against an authoritative source — no details are available yet.`;
  }

  const body = sentences.join(" ");
  return i.verified ? body : `${body} (Not yet verified against an authoritative source.)`;
}

export async function askDhanu(question: string): Promise<{
  matches: KbMatch[];
  confident: boolean;
}> {
  const session = await getSession();
  if (!session) throw new Error("Not authorized");

  const questionTokens = tokenize(question);
  const [entries, ingredients] = await Promise.all([
    prisma.knowledgeEntry.findMany(),
    prisma.ingredient.findMany(),
  ]);

  const scoredKb = entries.map((e) => ({
    id: e.id,
    kind: "kb" as const,
    category: e.category as string,
    title: e.title,
    cause: e.cause,
    answer: e.answer,
    source: e.source,
    score: scoreEntry(questionTokens, e),
  }));

  const scoredIngredients = ingredients.map((i) => ({
    id: i.id,
    kind: "ingredient" as const,
    category: i.type,
    title: i.name,
    cause: null as string | null,
    answer: ingredientAnswer(i),
    source: i.source,
    score: scoreEntry(questionTokens, {
      title: i.name,
      keywords: ingredientKeywords(i),
      answer: i.notes ?? "",
      cause: null,
    }),
  }));

  const scored = [...scoredKb, ...scoredIngredients]
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const best = scored[0];
  const confident = questionTokens.length > 0 && !!best && best.score >= 5;

  await prisma.kbQuestionLog.create({
    data: {
      question,
      matchedId: best?.id,
      matchTitle: best?.title,
      matchScore: best?.score ?? 0,
      askedByName: session.fullName,
    },
  });

  return { matches: scored, confident };
}

/** Super Admin only: extract the text of an uploaded PDF so it can be reviewed and saved as a knowledge entry. */
export async function extractPdfText(formData: FormData): Promise<string> {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded");
  if (file.type !== "application/pdf") throw new Error("Only PDF files are supported");

  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

export async function createKbEntry(data: {
  category: KbCategory;
  title: string;
  keywords: string;
  cause?: string;
  answer: string;
  source?: string;
}) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const entry = await prisma.knowledgeEntry.create({ data });

  await logAudit(session, {
    action: "CREATE_KB_ENTRY",
    entityType: "KnowledgeEntry",
    entityId: entry.id,
    summary: `Added Ask Dhanu entry "${entry.title}"`,
  });

  revalidatePath("/ask-dhanu");
  return entry;
}

export async function updateKbEntry(
  id: string,
  data: {
    category: KbCategory;
    title: string;
    keywords: string;
    cause?: string;
    answer: string;
    source?: string;
  }
) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  await prisma.knowledgeEntry.update({ where: { id }, data });

  await logAudit(session, {
    action: "UPDATE_KB_ENTRY",
    entityType: "KnowledgeEntry",
    entityId: id,
    summary: `Updated Ask Dhanu entry "${data.title}"`,
  });

  revalidatePath("/ask-dhanu");
}

export async function deleteKbEntry(id: string) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const entry = await prisma.knowledgeEntry.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_KB_ENTRY",
    entityType: "KnowledgeEntry",
    entityId: id,
    summary: `Deleted Ask Dhanu entry "${entry.title}"`,
  });

  revalidatePath("/ask-dhanu");
}
