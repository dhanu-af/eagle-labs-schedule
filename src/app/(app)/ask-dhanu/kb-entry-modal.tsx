"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createKbEntry, updateKbEntry } from "@/lib/actions/kb-actions";
import { KB_CATEGORY_LABEL } from "@/lib/ui";
import type { KbCategory } from "@/generated/prisma";
import type { KbEntry } from "./ask-dhanu-client";

const CATEGORY_OPTIONS = Object.keys(KB_CATEGORY_LABEL) as KbCategory[];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default function KbEntryModal({
  entry,
  onClose,
}: {
  entry: KbEntry | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const data = {
      category: formData.get("category") as KbCategory,
      title: String(formData.get("title") ?? ""),
      keywords: String(formData.get("keywords") ?? ""),
      cause: String(formData.get("cause") ?? "") || undefined,
      answer: String(formData.get("answer") ?? ""),
      source: String(formData.get("source") ?? "") || undefined,
    };
    startTransition(async () => {
      if (entry) {
        await updateKbEntry(entry.id, data);
      } else {
        await createKbEntry(data);
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {entry ? "Edit Knowledge Entry" : "Add Knowledge Entry"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <Field label="Category">
            <select
              name="category"
              defaultValue={entry?.category ?? "MACHINE_TROUBLESHOOTING"}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {KB_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title / Symptom">
            <input
              name="title"
              required
              defaultValue={entry?.title ?? ""}
              placeholder="e.g. Capsules are not closing properly"
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
          </Field>
          <Field label="Keywords (comma-separated, helps search match this entry)">
            <input
              name="keywords"
              required
              defaultValue={entry?.keywords ?? ""}
              placeholder="e.g. capsules not closing, closing plate gap"
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
          </Field>
          <Field label="Cause (optional)">
            <textarea
              name="cause"
              rows={2}
              defaultValue={entry?.cause ?? ""}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
          </Field>
          <Field label="Answer / Solution">
            <textarea
              name="answer"
              required
              rows={4}
              defaultValue={entry?.answer ?? ""}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
          </Field>
          <Field label="Source (optional)">
            <input
              name="source"
              defaultValue={entry?.source ?? ""}
              placeholder="e.g. NJP-800C manual, Section 8"
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
