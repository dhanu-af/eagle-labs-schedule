"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchBatchHistory, type BatchHistoryEntry } from "@/lib/actions/batch-lookup-actions";
import { formatBrisbaneDateTime } from "@/lib/ui";

const SOURCE_CLASS: Record<BatchHistoryEntry["source"], string> = {
  "Daily Operations": "border-info/30 bg-info/10 text-info",
  "Production Staging Operations": "border-warning/30 bg-warning/10 text-warning",
  "Batch Record": "border-primary/30 bg-primary/10 text-primary",
};

export default function BatchLookupCard() {
  const [batchNumber, setBatchNumber] = useState("");
  const [pending, startTransition] = useTransition();
  const [timeline, setTimeline] = useState<BatchHistoryEntry[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  function search() {
    if (!batchNumber.trim()) return;
    setError("");
    setNotFound(false);
    setTimeline(null);
    startTransition(async () => {
      try {
        const result = await searchBatchHistory(batchNumber);
        if (!result.found) {
          setNotFound(true);
        } else {
          setTimeline(result.timeline);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't search for that batch.");
      }
    });
  }

  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span aria-hidden>🔎</span> Batch Lookup
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex gap-2"
      >
        <input
          value={batchNumber}
          onChange={(e) => setBatchNumber(e.target.value)}
          placeholder="Enter a batch number..."
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={pending || !batchNumber.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-150 ease-out disabled:opacity-50"
        >
          {pending ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      {notFound && <p className="mt-3 text-xs text-muted-foreground">No records found for that batch number.</p>}

      {timeline && timeline.length > 0 && (
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {timeline.map((entry) => {
            const content = (
              <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-xs transition-colors duration-150 ease-out hover:border-primary/40">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_CLASS[entry.source]}`}>
                    {entry.source}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatBrisbaneDateTime(entry.at)}</span>
                </div>
                <p className="mt-1 text-foreground">{entry.summary}</p>
                <p className="text-muted-foreground">{entry.actorName}</p>
              </div>
            );
            return entry.href ? (
              <Link key={entry.id} href={entry.href} className="block">
                {content}
              </Link>
            ) : (
              <div key={entry.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
