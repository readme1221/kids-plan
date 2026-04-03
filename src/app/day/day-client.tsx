"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PeriodSection } from "@/components/schedule/period-section";
import { SlotCard } from "@/components/schedule/slot-card";
import { SlideDialog } from "@/components/schedule/slide-dialog";
import { AddHomeworkDialog } from "@/components/schedule/add-homework-dialog";
import { setupDay } from "@/server/actions/day-setup";
import { markTaskDone, slideTask, manualPinTask } from "@/server/actions/task-actions";
import { addHomework } from "@/server/actions/homework-actions";
import { getDayName } from "@/lib/time";
import { parseDate } from "@/lib/time";
import { PERIODS, type PeriodConfig, type PeriodName } from "@/modules/shared/types";
import { toast } from "sonner";
import type { SlideReason, TaskType } from "@/generated/prisma/client";

type SlotData = {
  id: string;
  period: string;
  order: number;
  sourceType: string;
  taskConfigId: string | null;
  homeworkId: string | null;
  isLocked: boolean;
  name: string;
  isCompleted: boolean;
};

type Props = {
  weekId: string;
  date: string;
  dayOfWeek: number;
  isOpen: boolean;
  dayPlanId: string | null;
  periodConfig: PeriodConfig;
  slots: SlotData[];
  availableTasks: { id: string; name: string; taskType: TaskType }[];
  pendingHomeworks: {
    id: string;
    title: string;
    deadlineType: string;
    deadlineDate: string;
  }[];
  todayActivities: { name: string; startTime: string; endTime: string }[];
  consecutiveSlideWarning: boolean;
};

export function DayPageClient({
  weekId,
  date,
  dayOfWeek,
  isOpen,
  dayPlanId,
  periodConfig,
  slots,
  availableTasks,
  pendingHomeworks,
  todayActivities,
  consecutiveSlideWarning,
}: Props) {
  const [slideTarget, setSlideTarget] = useState<SlotData | null>(null);
  const [showHomeworkDialog, setShowHomeworkDialog] = useState(false);
  const [showPinSelect, setShowPinSelect] = useState(false);

  const dateObj = parseDate(date);

  // ── 生成/重新生成当日计划 ──
  const handleSetupDay = async (open: boolean) => {
    const result = await setupDay({
      weekId,
      date: dateObj,
      isOpen: open,
      periodConfig,
    });

    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        if (w.type === "daily_deadline_conflict") {
          toast.warning(w.message);
        } else {
          toast.info(w.message);
        }
      }
    }
  };

  // ── 完成 ──
  const handleDone = async (slot: SlotData) => {
    await markTaskDone({ slotId: slot.id, weekId, date: dateObj });
    toast.success(`${slot.name} 已完成`);
  };

  // ── 滑移 ──
  const handleSlide = async (reason: SlideReason) => {
    if (!slideTarget) return;
    await slideTask({
      slotId: slideTarget.id,
      weekId,
      date: dateObj,
      reason,
    });
    setSlideTarget(null);
    toast("已滑移");
  };

  // ── 添加功课 ──
  const handleAddHomework = async (params: {
    title: string;
    deadlineType: "daily" | "weekly";
    deadlineDate: string;
  }) => {
    const result = await addHomework({
      weekId,
      title: params.title,
      deadlineType: params.deadlineType,
      deadlineDate: parseDate(params.deadlineDate),
      dayPlanId: dayPlanId ?? undefined,
    });

    if (result.warning) {
      toast.warning(result.warning);
    } else {
      toast.success("功课已添加");
    }
  };

  // ── 手动指定 ──
  const handleManualPin = async (taskId: string) => {
    if (!dayPlanId) {
      toast.error("请先生成当日计划");
      return;
    }
    // 找到有空位的时段
    const period = findPeriodWithSpace(slots, periodConfig);
    if (!period) {
      toast.error("所有时段已满");
      return;
    }
    await manualPinTask({
      dayPlanId,
      period,
      taskConfigId: taskId,
      weekId,
    });
    setShowPinSelect(false);
    toast.success("已手动指定");
  };

  // ── 按时段分组 slots ──
  const slotsByPeriod: Record<PeriodName, SlotData[]> = {
    morning: [],
    afternoon_early: [],
    afternoon_late: [],
    evening: [],
  };
  for (const slot of slots) {
    const period = slot.period as PeriodName;
    if (slotsByPeriod[period]) {
      slotsByPeriod[period].push(slot);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">
            {getDayName(dayOfWeek)} · {date}
          </h1>
          {todayActivities.length > 0 && (
            <div className="flex gap-1 mt-1">
              {todayActivities.map((a) => (
                <Badge key={a.name} variant="secondary" className="text-xs">
                  {a.name} {a.startTime}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => handleSetupDay(!isOpen)}
          variant={isOpen ? "default" : "outline"}
        >
          {dayPlanId ? "重新排程" : "生成计划"}
        </Button>
      </div>

      {/* Warnings */}
      {consecutiveSlideWarning && (
        <Card className="p-3 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">
            连续 2 天非功课任务完成数为 0，建议关注
          </p>
        </Card>
      )}

      {/* Pending homeworks */}
      {pendingHomeworks.length > 0 && (
        <Card className="p-3 bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-700 mb-1">待完成功课</p>
          <div className="space-y-1">
            {pendingHomeworks.map((hw) => (
              <div key={hw.id} className="flex items-center justify-between text-sm">
                <span>{hw.title}</span>
                <Badge
                  variant={hw.deadlineType === "daily" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {hw.deadlineDate}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Separator />

      {/* Period sections with slots */}
      {dayPlanId && isOpen ? (
        <div className="space-y-4">
          {PERIODS.map((period) => (
            <PeriodSection
              key={period}
              period={period}
              maxSlots={periodConfig[period].maxSlots}
              parentSlots={periodConfig[period].parentSlots}
              enabled={periodConfig[period].enabled}
            >
              {slotsByPeriod[period].length > 0 ? (
                slotsByPeriod[period]
                  .sort((a, b) => a.order - b.order)
                  .map((slot) => (
                    <SlotCard
                      key={slot.id}
                      id={slot.id}
                      name={slot.name}
                      sourceType={slot.sourceType}
                      isLocked={slot.isLocked}
                      isCompleted={slot.isCompleted}
                      onDone={() => handleDone(slot)}
                      onSlide={() => setSlideTarget(slot)}
                    />
                  ))
              ) : (
                <p className="text-xs text-gray-400 py-2">暂无任务</p>
              )}
            </PeriodSection>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">
            {isOpen ? '点击「生成计划」开始' : '今天休息'}
          </p>
        </div>
      )}

      {/* Bottom action bar */}
      {dayPlanId && isOpen && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-2">
          <div className="max-w-lg mx-auto flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowHomeworkDialog(true)}
            >
              + 功课
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowPinSelect(true)}
            >
              + 手动指定
            </Button>
          </div>
        </div>
      )}

      {/* Slide dialog */}
      {slideTarget && (
        <SlideDialog
          open={!!slideTarget}
          taskName={slideTarget.name}
          onClose={() => setSlideTarget(null)}
          onConfirm={handleSlide}
        />
      )}

      {/* Add homework dialog */}
      <AddHomeworkDialog
        open={showHomeworkDialog}
        onClose={() => setShowHomeworkDialog(false)}
        onAdd={handleAddHomework}
        defaultDate={date}
      />

      {/* Manual pin select */}
      {showPinSelect && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-4 pb-8 safe-area-bottom">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">选择任务</h3>
              <button
                onClick={() => setShowPinSelect(false)}
                className="text-gray-400 text-lg"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleManualPin(t.id)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 text-sm hover:bg-gray-100 active:bg-gray-200"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function findPeriodWithSpace(
  slots: SlotData[],
  config: PeriodConfig,
): PeriodName | null {
  for (const period of PERIODS) {
    if (!config[period].enabled) continue;
    const used = slots.filter((s) => s.period === period).length;
    if (used < config[period].parentSlots) return period;
  }
  return null;
}
