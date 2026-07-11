import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import AskDhanuClient from "./ask-dhanu-client";

export default async function AskDhanuPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const entries = await prisma.knowledgeEntry.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }],
  });

  const isSuperAdmin = canEdit(session.role);
  const recentQuestions = isSuperAdmin
    ? await prisma.kbQuestionLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
      })
    : [];

  return (
    <AskDhanuClient
      canEdit={isSuperAdmin}
      entries={entries.map((e) => ({
        id: e.id,
        category: e.category,
        title: e.title,
        keywords: e.keywords,
        cause: e.cause,
        answer: e.answer,
        source: e.source,
      }))}
      recentQuestions={recentQuestions.map((q) => ({
        id: q.id,
        question: q.question,
        matchTitle: q.matchTitle,
        matchScore: q.matchScore,
        askedByName: q.askedByName,
        createdAt: q.createdAt.toISOString(),
      }))}
    />
  );
}
