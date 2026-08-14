import { getPlanningCalendar, getPlanningSummaryCounts, searchPlanningRecords, type PlanningSection } from "@/lib/actions/planning-search-actions";
import PlanningSearchClient from "./planning-search-client";

function parseMonth(input?: string): Date {
  if (input) {
    const [y, m] = input.split("-").map(Number);
    if (y && m) return new Date(y, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const VALID_SECTIONS: (PlanningSection | "ALL")[] = ["ALL", "DEMAND", "MPS", "MATERIALS", "PRODUCTION", "ACTIONS", "KPI"];

export default async function PlanningSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; keyword?: string; section?: string; date?: string }>;
}) {
  const { month: monthParam, keyword, section, date } = await searchParams;
  const month = parseMonth(monthParam);
  const sectionFilter = VALID_SECTIONS.includes(section as (typeof VALID_SECTIONS)[number]) ? (section as PlanningSection | "ALL") : "ALL";

  const [calendar, summary, results] = await Promise.all([
    getPlanningCalendar(month),
    getPlanningSummaryCounts(),
    searchPlanningRecords({ keyword, section: sectionFilter, date: date || null }),
  ]);

  return (
    <PlanningSearchClient
      monthIso={`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`}
      calendar={calendar}
      summary={summary}
      results={results}
      keyword={keyword ?? ""}
      section={sectionFilter}
      date={date ?? ""}
    />
  );
}
