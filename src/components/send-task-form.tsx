"use client";

import { useState, useTransition } from "react";
import { sendTaskRequest } from "@/lib/actions/task-request-actions";
import { PRIORITY_LABEL } from "@/lib/ui";
import type { Priority } from "@/generated/prisma";

export type UserOption = { id: string; fullName: string; roleLabel: string };

const PRIORITIES: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/**
 * The compose-and-send form, shared by the global header button
 * (send-task-button.tsx) and any page-specific "send for review" action (e.g.
 * Environmental Checks after Sign & Submit). Callers pre-fill title/message/link
 * to point at whatever record prompted the request; the recipient still always
 * picks a person and can edit anything before sending.
 */
export default function SendTaskForm({
  users,
  initialTitle = "",
  initialMessage = "",
  initialPriority = "MEDIUM",
  link = null,
  onSent,
  onCancel,
}: {
  users: UserOption[];
  initialTitle?: string;
  initialMessage?: string;
  initialPriority?: Priority;
  link?: string | null;
  onSent: () => void;
  onCancel: () => void;
}) {
  const [toUserId, setToUserId] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [message, setMessage] = useState(initialMessage);
  const [priority, setPriority] = useState<Priority>(initialPriority);
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function send() {
    setError("");
    if (!toUserId) return setError("Choose who this task is for.");
    if (!title.trim()) return setError("Title is required.");
    startTransition(async () => {
      try {
        await sendTaskRequest(toUserId, { title: title.trim(), message: message.trim() || null, priority, dueDate: dueDate || null, link });
        onSent();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send task.");
      }
    });
  }

  const grouped = users.reduce<Record<string, UserOption[]>>((acc, u) => {
    (acc[u.roleLabel] ??= []).push(u);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">To</span>
        <select className="input" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
          <option value="">Select a person...</option>
          {Object.entries(grouped).map(([roleLabel, roleUsers]) => (
            <optgroup key={roleLabel} label={roleLabel}>
              {roleUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Approve PO for capsule shells" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Message</span>
        <textarea className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Priority</span>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</span>
          <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted"
        >
          Cancel
        </button>
        <button
          onClick={send}
          disabled={pending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-150 ease-out hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
