"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAnnouncement } from "@/lib/actions/announcement-actions";

export default function PostAnnouncementCard() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function post() {
    if (!value.trim()) return;
    startTransition(async () => {
      await createAnnouncement(value.trim());
      setValue("");
      router.refresh();
    });
  }

  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span aria-hidden>📣</span> Post Announcement
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          post();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Post an announcement for all staff..."
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Posting..." : "Post"}
        </button>
      </form>
    </div>
  );
}
