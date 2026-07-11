"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notification-actions";

type Notification = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground hover:bg-surface-muted transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    markAllNotificationsRead().then(() => router.refresh());
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "#"}
                onClick={() => {
                  setOpen(false);
                  if (!n.read) markNotificationRead(n.id).then(() => router.refresh());
                }}
                className={`block border-b border-border px-3 py-2 text-sm last:border-0 hover:bg-surface-muted ${
                  n.read ? "" : "bg-primary/5"
                }`}
              >
                <p className="font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
