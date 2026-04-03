"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProgressStage, TaskType } from "@/generated/prisma/client";

type TaskCardProps = {
  name: string;
  taskType: TaskType;
  doneCount: number;
  budget: number | null;
  requiredSlots: number | null;
  progressStage: ProgressStage;
  carriedOverSlots: number;
  isActiveThisWeek: boolean;
  onProgressChange?: (stage: ProgressStage) => void;
};

const PROGRESS_LABELS: Record<ProgressStage, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  mostly_done: "基本完成",
  completed_for_week: "本周完成",
};

const PROGRESS_COLORS: Record<ProgressStage, string> = {
  not_started: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  mostly_done: "bg-yellow-100 text-yellow-700",
  completed_for_week: "bg-green-100 text-green-700",
};

const TYPE_LABELS: Record<TaskType, string> = {
  quota_weekly: "配额",
  deadline_weekly: "周截止",
  deadline_daily: "日截止",
  fixed_time: "固定时点",
};

export function TaskCard({
  name,
  taskType,
  doneCount,
  budget,
  requiredSlots,
  progressStage,
  carriedOverSlots,
  isActiveThisWeek,
  onProgressChange,
}: TaskCardProps) {
  const target = taskType === "deadline_weekly" ? requiredSlots : budget;
  const ratio = target ? doneCount / target : 0;

  return (
    <Card
      className={cn(
        "p-4 transition-opacity",
        !isActiveThisWeek && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{name}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {TYPE_LABELS[taskType]}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {target !== null && target !== undefined && (
              <span className="text-gray-600">
                <span className={cn("font-semibold", ratio >= 1 && "text-green-600")}>
                  {doneCount}
                </span>
                <span className="text-gray-400">/{target}</span>
              </span>
            )}

            {carriedOverSlots > 0 && (
              <span className="text-orange-500 text-xs">
                +{carriedOverSlots} 结转
              </span>
            )}
          </div>

          {/* Progress bar */}
          {target !== null && target !== undefined && target > 0 && (
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  ratio >= 1 ? "bg-green-500" : ratio >= 0.5 ? "bg-blue-500" : "bg-gray-300",
                )}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Progress stage button */}
        {taskType !== "fixed_time" && onProgressChange && (
          <button
            onClick={() => {
              const stages: ProgressStage[] = [
                "not_started",
                "in_progress",
                "mostly_done",
                "completed_for_week",
              ];
              const idx = stages.indexOf(progressStage);
              const next = stages[(idx + 1) % stages.length];
              onProgressChange(next);
            }}
            className={cn(
              "text-[10px] px-2 py-1 rounded-full whitespace-nowrap",
              PROGRESS_COLORS[progressStage],
            )}
          >
            {PROGRESS_LABELS[progressStage]}
          </button>
        )}
      </div>
    </Card>
  );
}
