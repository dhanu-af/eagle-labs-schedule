"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { askDhanu, deleteKbEntry, type KbMatch } from "@/lib/actions/kb-actions";
import { KB_CATEGORY_CLASS, KB_CATEGORY_LABEL } from "@/lib/ui";
import type { KbCategory } from "@/generated/prisma";
import KbEntryModal from "./kb-entry-modal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export type KbEntry = {
  id: string;
  category: KbCategory;
  title: string;
  keywords: string;
  cause: string | null;
  answer: string;
  source: string | null;
};

type RecentQuestion = {
  id: string;
  question: string;
  matchTitle: string | null;
  matchScore: number | null;
  askedByName: string;
  createdAt: string;
};

const CATEGORY_ORDER: KbCategory[] = [
  "BLENDING_SOP",
  "MACHINE_TROUBLESHOOTING",
  "MAINTENANCE_CLEANING",
  "SAFETY",
  "PARTS",
  "QUALITY_CONTROL",
  "QUALITY_ASSURANCE",
  "HACCP",
  "SQF",
  "GMP",
  "GDP",
  "FOOD_SAFETY",
  "MANUAL_HANDLING",
  "RAW_MATERIALS_INGREDIENTS",
  "FORMULATIONS",
  "PRODUCTION",
  "PACKAGING",
  "EQUIPMENT_MAINTENANCE",
  "CLEANING_SANITATION",
  "ENVIRONMENTAL_MONITORING",
  "WHS",
  "TEAMWORK_COMMUNICATION",
  "TRAINING_INDUCTION",
  "SOPS",
  "POLICIES_PROCEDURES",
];

const SAMPLE_QUESTIONS = [
  "Capsules are not closing properly, what do I do?",
  "Machine suddenly stopped while running",
  "What PPE do I need before entering the blending room?",
  "How often should I lubricate the machine?",
];

function AnswerCard({ match, highlight }: { match: KbMatch; highlight?: boolean }) {
  return (
    <div
      className={`card-shadow rounded-xl border p-5 ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${KB_CATEGORY_CLASS[match.category]}`}>
          {KB_CATEGORY_LABEL[match.category]}
        </span>
        {highlight && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Best match
          </span>
        )}
      </div>
      <h3 className="mb-1.5 text-sm font-semibold text-foreground">{match.title}</h3>
      {match.cause && (
        <p className="mb-1.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Likely cause: </span>
          {match.cause}
        </p>
      )}
      <p className="whitespace-pre-line text-sm text-foreground">{match.answer}</p>
      {match.source && <p className="mt-2 text-xs text-muted-foreground">Source: {match.source}</p>}
    </div>
  );
}

export default function AskDhanuClient({
  canEdit,
  entries,
  recentQuestions,
}: {
  canEdit: boolean;
  entries: KbEntry[];
  recentQuestions: RecentQuestion[];
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ matches: KbMatch[]; confident: boolean } | null>(null);

  const [browseFilter, setBrowseFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState<KbCategory | "ALL">("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [editEntry, setEditEntry] = useState<KbEntry | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showManage, setShowManage] = useState(false);

  function ask(q: string) {
    if (!q.trim()) return;
    startTransition(async () => {
      const res = await askDhanu(q);
      setResult(res);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this knowledge entry? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteKbEntry(id);
      router.refresh();
    });
  }

  const filteredEntries = useMemo(() => {
    const q = browseFilter.trim().toLowerCase();
    return entries.filter((e) => {
      if (activeCategory !== "ALL" && e.category !== activeCategory) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.keywords.toLowerCase().includes(q) ||
        e.answer.toLowerCase().includes(q)
      );
    });
  }, [entries, browseFilter, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<KbCategory, KbEntry[]>();
    for (const e of filteredEntries) {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    }
    return map;
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dhanu AI"
        subtitle="Powered by Dhanu's knowledge and expertise. Ask anything about SOPs, quality, production, equipment, formulations, or workplace procedures."
      />

      <div className="glass card-shadow rounded-xl border border-border p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask Dhanu AI anything..."
            className="input flex-1"
          />
          <Button type="submit" disabled={pending || !question.trim()}>
            {pending ? "Searching..." : "Ask"}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQuestion(s);
                ask(s);
              }}
              className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          {result.matches.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-surface">
              <EmptyState title="No matching answer found yet." description="Your question has been logged — ask your supervisor or Dhanu directly for now, and this will help expand the knowledge base." />
            </div>
          )}
          {result.matches.length > 0 && !result.confident && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
              Not fully sure this matches — closest entries are shown below. Your question has been logged for follow-up.
            </div>
          )}
          {result.matches.map((m, i) => (
            <AnswerCard key={m.id} match={m} highlight={result.confident && i === 0} />
          ))}
        </div>
      )}

      {canEdit && (
        <div className="space-y-3">
          <Button variant="secondary" onClick={() => setShowManage((v) => !v)}>
            {showManage ? "Hide" : "Manage"} knowledge base
          </Button>

          {showManage && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Browse knowledge base</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => setShowLog((v) => !v)}>
                    {showLog ? "Hide" : "View"} recent questions
                  </Button>
                  <Button onClick={() => setShowAdd(true)}>+ Add Entry</Button>
                </div>
              </div>

              {showLog && (
                <Card padding="sm">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Recent questions asked</h3>
                  {recentQuestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No questions asked yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {recentQuestions.map((q) => (
                        <div key={q.id} className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
                          <p className="text-foreground">&ldquo;{q.question}&rdquo;</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {q.askedByName} · {new Date(q.createdAt).toLocaleString("en-AU")} ·{" "}
                            {q.matchTitle ? `matched: ${q.matchTitle} (score ${q.matchScore})` : "no match found"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCategory("ALL")}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out ${
                    activeCategory === "ALL" ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {CATEGORY_ORDER.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out ${
                      activeCategory === c ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {KB_CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>

              <input
                value={browseFilter}
                onChange={(e) => setBrowseFilter(e.target.value)}
                placeholder="Filter entries..."
                className="input sm:max-w-xs"
              />

              {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => (
                <div key={c} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">{KB_CATEGORY_LABEL[c]}</h3>
                  <div className="space-y-2">
                    {grouped.get(c)!.map((e) => (
                      <details key={e.id} className="group rounded-xl border border-border bg-surface p-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{e.title}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(ev) => {
                                ev.preventDefault();
                                setEditEntry(e);
                              }}
                              className="text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(ev) => {
                                ev.preventDefault();
                                remove(e.id);
                              }}
                              className="text-xs font-medium text-danger transition-colors duration-150 ease-out hover:opacity-80"
                            >
                              Delete
                            </button>
                            <span className="text-muted-foreground transition-transform duration-200 group-open:rotate-180">▾</span>
                          </div>
                        </summary>
                        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                          {e.cause && (
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">Likely cause: </span>
                              {e.cause}
                            </p>
                          )}
                          <p className="whitespace-pre-line text-sm text-foreground">{e.answer}</p>
                          {e.source && <p className="text-xs text-muted-foreground">Source: {e.source}</p>}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
              {filteredEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">No entries match this filter.</p>
              )}
            </div>
          )}
        </div>
      )}

      {(showAdd || editEntry) && (
        <KbEntryModal
          entry={editEntry}
          onClose={() => {
            setShowAdd(false);
            setEditEntry(null);
          }}
        />
      )}
    </div>
  );
}
