export function GroupToggle({
  view,
  onChange,
}: {
  view: "day" | "week";
  onChange: (v: "day" | "week") => void;
}) {
  return (
    <div className="flex gap-1">
      {(["day", "week"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ease-out ${
            view === v ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {v === "day" ? "Daily" : "Weekly"}
        </button>
      ))}
    </div>
  );
}

export function GroupHeaderRow({ colSpan, label, count }: { colSpan: number; label: string; count: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-surface-muted/60 px-3 py-1.5 text-xs font-semibold text-foreground">
        {label} <span className="font-normal text-muted-foreground">({count} record{count === 1 ? "" : "s"})</span>
      </td>
    </tr>
  );
}
