"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sendChatMessage,
  editChatMessage,
  deleteChatMessage,
  toggleChatReaction,
  markChatRead,
  pingPresence,
  setTyping,
  getChatPresence,
} from "@/lib/actions/chat-actions";
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
  editedAt: string | null;
  replyTo: { id: string; authorName: string; message: string } | null;
  reactions: { userId: string; userName: string; emoji: string }[];
};

type RosterUser = { id: string; name: string };

const POLL_MS = 4000;
const PRESENCE_POLL_MS = 2500;
const PING_MS = 15000;
const TYPING_THROTTLE_MS = 2000;
const QUICK_REACTIONS = ["👍", "❤️", "😂"];

export default function TeamChatClient({
  currentUserId,
  messages,
  roster,
  initialOnlineUserIds,
  initialReceipts,
}: {
  currentUserId: string | null;
  messages: ChatMessage[];
  roster: RosterUser[];
  initialOnlineUserIds: string[];
  initialReceipts: Record<string, string>;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState(initialOnlineUserIds);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [receipts, setReceipts] = useState(initialReceipts);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingCallRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Full message list refresh — the slow, authoritative poll.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  // Presence/typing/receipts — a cheap, frequent poll that doesn't re-render the message list.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const p = await getChatPresence();
      if (cancelled) return;
      setOnlineUserIds(p.onlineUserIds);
      setTypingNames(p.typingNames);
      setReceipts(p.receipts);
    }
    tick();
    const id = setInterval(tick, PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Presence heartbeat.
  useEffect(() => {
    pingPresence();
    const id = setInterval(() => pingPresence(), PING_MS);
    return () => clearInterval(id);
  }, []);

  // Mark the room as read whenever it's open and new messages land.
  useEffect(() => {
    markChatRead();
  }, [messages.length]);

  function send() {
    const text = value.trim();
    if (!text) return;
    const replyToId = replyingTo?.id;
    setValue("");
    setReplyingTo(null);
    startTransition(async () => {
      await sendChatMessage(text, replyToId);
      router.refresh();
    });
  }

  function handleInputChange(text: string) {
    setValue(text);
    const now = Date.now();
    if (now - lastTypingCallRef.current > TYPING_THROTTLE_MS) {
      lastTypingCallRef.current = now;
      setTyping();
    }
  }

  function startEdit(m: ChatMessage) {
    setEditingId(m.id);
    setEditingValue(m.message);
  }

  function saveEdit() {
    const text = editingValue.trim();
    if (!text || !editingId) return;
    const id = editingId;
    setEditingId(null);
    startTransition(async () => {
      await editChatMessage(id, text);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteChatMessage(id);
      router.refresh();
    });
  }

  function react(id: string, emoji: string) {
    startTransition(async () => {
      await toggleChatReaction(id, emoji);
      router.refresh();
    });
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // clipboard permission denied — silently ignore, non-critical
    }
  }

  function receiptStatus(m: ChatMessage): "sent" | "delivered" | "read" {
    const createdAt = new Date(m.createdAt).getTime();
    const readByOther = Object.entries(receipts).some(
      ([uid, iso]) => uid !== currentUserId && new Date(iso).getTime() >= createdAt
    );
    if (readByOther) return "read";
    if (Date.now() - createdAt > POLL_MS) return "delivered";
    return "sent";
  }

  function groupedReactions(m: ChatMessage) {
    const map = new Map<string, { emoji: string; count: number; mine: boolean; names: string[] }>();
    for (const r of m.reactions) {
      const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] };
      g.count += 1;
      g.names.push(r.userName);
      if (r.userId === currentUserId) g.mine = true;
      map.set(r.emoji, g);
    }
    return Array.from(map.values());
  }

  const rosterById = new Map(roster.map((r) => [r.id, r.name]));

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Team Chat"
        subtitle="Collaborate, share updates, and stay connected with your team in one place."
      />

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-surface p-4 card-shadow">
        {messages.length === 0 && <EmptyState title="No messages yet. Say hello 👋" />}
        {messages.map((m) => {
          const isMe = !!currentUserId && m.authorId === currentUserId;
          const isOnline = !!m.authorId && onlineUserIds.includes(m.authorId);
          const isEditing = editingId === m.id;
          const reactions = groupedReactions(m);
          const status = isMe ? receiptStatus(m) : null;

          return (
            <div key={m.id} className={`group flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className="relative shrink-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {initials(m.authorName)}
                </div>
                {isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" />
                )}
              </div>

              <div className="relative max-w-[75%]">
                <div
                  className={`flex items-center gap-1 pb-1 ${
                    isMe ? "justify-end" : "justify-start"
                  } opacity-0 transition-opacity duration-150 group-hover:opacity-100`}
                >
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => react(m.id, emoji)}
                      className="rounded-full px-1.5 py-0.5 text-sm transition-colors duration-150 ease-out hover:bg-surface-muted"
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => setReplyingTo(m)}
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => copyText(m.id, m.message)}
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground"
                  >
                    {copiedId === m.id ? "Copied!" : "Copy"}
                  </button>
                  {isMe && (
                    <>
                      <button
                        onClick={() => startEdit(m)}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(m.id)}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-danger transition-colors duration-150 ease-out hover:bg-surface-muted"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                <div
                  className={`rounded-2xl px-3.5 py-2 ${
                    isMe
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-surface-muted text-foreground"
                  }`}
                >
                  {!isMe && (
                    <p className="mb-0.5 text-[11px] font-semibold text-primary">
                      {m.authorName} <span className="font-normal text-muted-foreground">· {ROLE_LABEL[m.authorRole]}</span>
                    </p>
                  )}

                  {m.replyTo && (
                    <div
                      className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${
                        isMe ? "border-primary-foreground/40 bg-primary-foreground/10" : "border-primary/40 bg-surface"
                      }`}
                    >
                      <p className={`font-medium ${isMe ? "text-primary-foreground" : "text-primary"}`}>
                        {m.replyTo.authorName}
                      </p>
                      <p className={`truncate ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {m.replyTo.message}
                      </p>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        rows={2}
                        autoFocus
                        className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={pending}
                          className="text-[11px] font-semibold text-primary hover:opacity-80 disabled:opacity-60"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-line text-sm">{m.message}</p>
                      <div
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {m.editedAt && <span className="italic">edited</span>}
                        <span>{formatBrisbaneDateTime(m.createdAt)}</span>
                        {status && (
                          <span
                            className={status === "read" ? "text-primary-foreground" : ""}
                            title={status[0].toUpperCase() + status.slice(1)}
                          >
                            {status === "sent" ? "✓" : "✓✓"}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {reactions.length > 0 && (
                  <div className={`mt-1 flex flex-wrap gap-1 ${isMe ? "justify-end" : "justify-start"}`}>
                    {reactions.map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() => react(m.id, r.emoji)}
                        title={r.names.join(", ")}
                        className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors duration-150 ease-out ${
                          r.mine ? "border-primary/40 bg-primary/10" : "border-border bg-surface-muted"
                        }`}
                      >
                        <span>{r.emoji}</span>
                        <span className="text-muted-foreground">{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {typingNames.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <span>
            {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing
          </span>
          <span className="flex items-center gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
            <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
            <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      )}

      {replyingTo && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              Replying to {replyingTo.authorId === currentUserId ? "yourself" : rosterById.get(replyingTo.authorId ?? "") ?? replyingTo.authorName}
            </p>
            <p className="truncate text-muted-foreground">{replyingTo.message}</p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="shrink-0 text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
            aria-label="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className={`flex items-center gap-2 ${replyingTo ? "mt-2" : "mt-3"}`}
      >
        <input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
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
