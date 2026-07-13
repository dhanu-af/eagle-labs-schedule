"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createKbEntry, updateKbEntry, extractPdfText } from "@/lib/actions/kb-actions";
import { KB_CATEGORY_LABEL } from "@/lib/ui";
import type { KbCategory } from "@/generated/prisma";
import type { KbEntry } from "./ask-dhanu-client";
import { Button } from "@/components/ui/Button";

const CATEGORY_OPTIONS = Object.keys(KB_CATEGORY_LABEL) as KbCategory[];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function titleFromFileName(fileName: string) {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
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
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [titleValue, setTitleValue] = useState(entry?.title ?? "");
  const [answerValue, setAnswerValue] = useState(entry?.answer ?? "");
  const [sourceValue, setSourceValue] = useState(entry?.source ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractError(null);
    setExtracting(true);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const text = await extractPdfText(fd);
        if (!text) {
          setExtractError("No selectable text was found in this PDF (it may be a scanned image).");
        } else {
          setAnswerValue(text);
          if (!titleValue.trim()) setTitleValue(titleFromFileName(file.name));
          if (!sourceValue.trim()) setSourceValue(file.name);
        }
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : "Couldn't read that PDF.");
      } finally {
        setExtracting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {entry ? "Edit Knowledge Entry" : "Add Knowledge Entry"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Field label="Or upload a PDF — its text will fill in the Answer field below for you to review">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handlePdfChange}
              disabled={extracting}
              className="w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground file:transition-colors file:duration-150 file:ease-out"
            />
          </Field>
          {extracting && <p className="mt-1.5 text-xs text-muted-foreground">Extracting text…</p>}
          {extractError && <p className="mt-1.5 text-xs text-danger">{extractError}</p>}
        </div>

        <form action={submit} className="space-y-3">
          <Field label="Category">
            <select
              name="category"
              defaultValue={entry?.category ?? "MACHINE_TROUBLESHOOTING"}
              className="input"
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
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              placeholder="e.g. Capsules are not closing properly"
              className="input"
            />
          </Field>
          <Field label="Keywords (comma-separated, helps search match this entry)">
            <input
              name="keywords"
              required
              defaultValue={entry?.keywords ?? ""}
              placeholder="e.g. capsules not closing, closing plate gap"
              className="input"
            />
          </Field>
          <Field label="Cause (optional)">
            <textarea
              name="cause"
              rows={2}
              defaultValue={entry?.cause ?? ""}
              className="input"
            />
          </Field>
          <Field label="Answer / Solution">
            <textarea
              name="answer"
              required
              rows={8}
              value={answerValue}
              onChange={(e) => setAnswerValue(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Source (optional)">
            <input
              name="source"
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              placeholder="e.g. NJP-800C manual, Section 8"
              className="input"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
