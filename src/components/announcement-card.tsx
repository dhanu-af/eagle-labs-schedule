"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAnnouncement } from "@/lib/actions/announcement-actions";

export default function AnnouncementCard({
  id,
  title,
  message,
  canManage,
  highlight,
}: {
  id: string;
  title: string;
  message: string;
  canManage: boolean;
  highlight?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(message);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateAnnouncement(id, value);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-primary/30 bg-primary/5" : "border-border bg-surface"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {canManage && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setValue(message);
                setEditing(false);
              }}
              className="rounded-lg border border-border px-3 py-1 text-xs text-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
