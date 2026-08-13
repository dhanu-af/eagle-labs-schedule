"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAlerts } from "@/lib/actions/alert-engine-actions";
import { Button } from "@/components/ui/Button";

export default function SyncAlertsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      try {
        const { created, skipped } = await syncAlerts();
        setResult(
          created === 0
            ? `No new alerts — ${skipped} issue${skipped === 1 ? "" : "s"} already notified today.`
            : `Pushed ${created} new alert${created === 1 ? "" : "s"} to managers' notifications.`
        );
        router.refresh();
      } catch (err) {
        setResult(err instanceof Error ? err.message : "Couldn't sync alerts.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
      <Button size="sm" variant="secondary" onClick={run} disabled={pending}>
        {pending ? "Checking..." : "Check for New Alerts"}
      </Button>
    </div>
  );
}
