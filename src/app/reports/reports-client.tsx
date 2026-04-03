"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/report/stat-card";
import { cn } from "@/lib/utils";
import type { WeekReportData } from "@/server/queries/report";

const SLIDE_REASON_LABELS: Record<string, string> = {
  time_insufficient: "时间不够",
  child_gave_up: "孩子主动放弃",
  parent_manual: "家长手动滑移",
  fixed_missed: "固定时点未执行",
  deadline_expired: "已过截止",
};

const PROGRESS_LABELS: Record<string, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  mostly_done: "基本完成",
  completed_for_week: "本周完成",
};

type Props = {
  report: WeekReportData;
  weeks: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  }[];
  currentWeekId: string;
};

export function ReportsClient({ report, weeks, currentWeekId }: Props) {
  const router = useRouter();

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">周报告</h1>
        <select
          value={currentWeekId}
          onChange={(e) => router.push(`/reports?weekId=${e.target.value}`)}
          className="text-sm bg-[#1C2541] border-[#2a3a5c] border rounded-lg px-2 py-1"
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.startDate} ~ {w.endDate}
              {w.status === "active" ? " (本周)" : ""}
            </option>
          ))}
        </select>
      </div>

      <Badge variant={report.status === "active" ? "default" : "secondary"}>
        {report.status === "active" ? "进行中" : "已结算"}
      </Badge>

      {/* Overall completion */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          title="总完成率"
          value={`${report.overallCompletionRate}%`}
          color={report.overallCompletionRate >= 70 ? "green" : report.overallCompletionRate >= 40 ? "yellow" : "red"}
        />
        <StatCard
          title="功课完成"
          value={`${report.homeworkStats.done}/${report.homeworkStats.total}`}
          subtitle={report.homeworkStats.overdue > 0 ? `${report.homeworkStats.overdue}项过期` : undefined}
          color={report.homeworkStats.overdue > 0 ? "red" : "green"}
        />
        <StatCard
          title="滑移次数"
          value={Object.values(report.slideReasons).reduce((a, b) => a + b, 0)}
          color="yellow"
        />
      </div>

      <Separator />

      {/* ── 三栏：功课 / 配额 / 固定时点 ── */}

      {/* 功课详情 */}
      <section>
        <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">功课</h2>
        <Card className="p-3">
          <div className="grid grid-cols-3 text-center text-sm">
            <div>
              <p className="text-[#CBD5E1]/60 text-xs">总数</p>
              <p className="font-bold">{report.homeworkStats.total}</p>
            </div>
            <div>
              <p className="text-[#CBD5E1]/60 text-xs">完成</p>
              <p className="font-bold text-[#5BC0BE]">{report.homeworkStats.done}</p>
            </div>
            <div>
              <p className="text-[#CBD5E1]/60 text-xs">过期</p>
              <p className={cn("font-bold", report.homeworkStats.overdue > 0 ? "text-[#F59E0B]" : "text-[#CBD5E1]/40")}>
                {report.homeworkStats.overdue}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* 配额型任务 */}
      <section>
        <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">配额型任务</h2>
        <div className="space-y-2">
          {report.quotaStats.tasks.map((t) => {
            const ratio = t.budget > 0 ? t.doneCount / t.budget : 0;
            return (
              <Card key={t.name} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-[#CBD5E1]/40">
                    {PROGRESS_LABELS[t.progressStage]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-[#2a3a5c] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        ratio >= 1 ? "bg-[#5BC0BE]" : ratio >= 0.5 ? "bg-[#1B998B]" : "bg-[#F3C969]/50",
                      )}
                      style={{ width: `${Math.min(100, ratio * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-[#CBD5E1] whitespace-nowrap">
                    {t.doneCount}/{t.budget}
                  </span>
                </div>
                {t.carriedOverSlots > 0 && (
                  <p className="text-xs text-[#F3C969] mt-1">
                    结转 {t.carriedOverSlots} 槽
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* 固定时点 */}
      {report.fixedTimeStats.tasks.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">固定时点</h2>
          <div className="space-y-2">
            {report.fixedTimeStats.tasks.map((t) => (
              <Card key={t.name} className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.name}</span>
                  <div className="flex gap-3 text-sm">
                    <span className="text-[#5BC0BE]">完成 {t.doneCount}</span>
                    {t.missedCount > 0 && (
                      <span className="text-[#F59E0B]">错过 {t.missedCount}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Separator />

      {/* 滑移原因统计 */}
      {Object.keys(report.slideReasons).length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">滑移原因</h2>
          <Card className="p-3">
            <div className="space-y-2">
              {Object.entries(report.slideReasons)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between text-sm">
                    <span className="text-[#CBD5E1]">
                      {SLIDE_REASON_LABELS[reason] ?? reason}
                    </span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
            </div>
          </Card>
        </section>
      )}

      {/* 预警记录 */}
      {report.warnings.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">预警</h2>
          <div className="space-y-1">
            {report.warnings.map((w, i) => (
              <Card key={i} className="p-3 bg-[#F59E0B]/10 border-[#F59E0B]/30">
                <p className="text-sm text-[#F59E0B]">{w}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
