export const dynamic = "force-dynamic";

import { getWeekList, getWeekReport } from "@/server/queries/report";
import { getOrCreateActiveWeek } from "@/server/queries/week";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ weekId?: string }>;
}) {
  const params = await searchParams;
  const weeks = await getWeekList();
  const activeWeek = await getOrCreateActiveWeek();

  const targetWeekId = params.weekId ?? activeWeek.id;
  const report = await getWeekReport(targetWeekId);

  return (
    <ReportsClient
      report={report}
      weeks={weeks.map((w) => ({
        id: w.id,
        startDate: w.startDate.toISOString().slice(0, 10),
        endDate: w.endDate.toISOString().slice(0, 10),
        status: w.status,
      }))}
      currentWeekId={targetWeekId}
    />
  );
}
