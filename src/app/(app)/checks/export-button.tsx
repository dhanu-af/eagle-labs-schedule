export function ExportButton({ type }: { type: string }) {
  return (
    <a
      href={`/api/reports/checks?type=${type}`}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
    >
      Export to Excel
    </a>
  );
}
