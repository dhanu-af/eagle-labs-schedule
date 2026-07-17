/** Pages a Role.OTHERS user can be restricted to — a single-page nav for narrowly-scoped external
 * or single-purpose accounts. Shared between AppShell (rendering) and User Management (picking one). */
export const RESTRICTED_PAGE_OPTIONS: { href: string; label: string; icon: string }[] = [
  { href: "/ask-dhanu", label: "Dhanu AI", icon: "🤖" },
  { href: "/drying-room", label: "Production Staging Operations", icon: "🏭" },
];

export const DEFAULT_RESTRICTED_HREF = RESTRICTED_PAGE_OPTIONS[0].href;
