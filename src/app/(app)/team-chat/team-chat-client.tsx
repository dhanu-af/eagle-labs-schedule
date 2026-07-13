"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendChatMessage } from "@/lib/actions/chat-actions";
import { formatBrisbaneDateTime, initials } from "@/lib/ui";
import { ROLE_LABEL } from "@/app/(app)/team/team-client";
import type { Role } from "@/generated/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export type ChatMessage = {
  id: string;
  authorId: string | null;
  authorName: string;
  authorRole: Role;
  message: string;
  createdAt: string;
};

const POLL_MS = 4000;

export default function TeamChatClient({
  currentUserId,
  messages,
}: {
  currentUserId: string | null;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  function send() {
    const text = value.trim();
    if (!text) return;
    setValue("");
    startTransition(async () => {
      await sendChatMessage(text);
      router.refresh();
    });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader title="Team Chat" subtitle="One shared room — every team member can post here." />

      <div
        ref={listRef}
        className="card-shadow mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-surface p-4"
      >
        {messages.length === 0 && <EmptyState title="No messages yet. Say hello 👋" />}
        {messages.map((m) => {
          const isMe = !!currentUserId && m.authorId === currentUserId;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {initials(m.authorName)}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                isMe
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm border border-border bg-surface-muted text-foreground"
              }`}>
                {!isMe && (
                  <p className="mb-0.5 text-[11px] font-semibold text-primary">
                    {m.authorName} <span className="font-normal text-muted-foreground">· {ROLE_LABEL[m.authorRole]}</span>
                  </p>
                )}
                <p className="whitespace-pre-line text-sm">{m.message}</p>
                <p className={`mt-1 text-right text-[10px] ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatBrisbaneDateTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-foreground transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:border-primary"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-150 ease-out hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
          Send
        </button>
      </form>
    </div>
  );
}
