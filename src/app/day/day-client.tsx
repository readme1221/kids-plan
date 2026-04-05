"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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

const PERIOD_LABELS: Record<PeriodName, string> = {
  morning: "上午",
  afternoon_early: "下午前",
  afternoon_late: "下午后",
  evening: "晚上",
};

export function DayPageClient({
  weekId,
  date,
  dayOfWeek,
  isOpen,
  dayPlanId,
  periodConfig: initialPeriodConfig,
  slots,
  availableTasks,
  pendingHomeworks,
  todayActivities,
  consecutiveSlideWarning,
}: Props) {
  // ── 流程状态 ──
  // "idle" = 未开始 / 已有计划
  // "setup" = 步骤 1-3：选时段、定槽数、加功课
  // "done" = 已生成计划，显示槽位
  const [phase, setPhase] = useState<"idle" | "setup" | "done">(
    dayPlanId ? "done" : "idle",
  );

  // 可编辑的 periodConfig（步骤 1-2 用）
  const [editConfig, setEditConfig] = useState<PeriodConfig>(initialPeriodConfig);

  const [slideTarget, setSlideTarget] = useState<SlotData | null>(null);
  const [showHomeworkDialog, setShowHomeworkDialog] = useState(false);
  const [showPinSelect, setShowPinSelect] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dateObj = parseDate(date);

  // ── 步骤 1-2：切换时段开关 ──
  const togglePeriod = (period: PeriodName) => {
    setEditConfig((prev) => ({
      ...prev,
      [period]: {
        ...prev[period],
        enabled: !prev[period].enabled,
        parentSlots: !prev[period].enabled ? prev[period].maxSlots : 0,
      },
    }));
  };

  // ── 步骤 2：调整槽数 ──
  const setPeriodSlots = (period: PeriodName, slots: number) => {
    setEditConfig((prev) => ({
      ...prev,
      [period]: { ...prev[period], parentSlots: slots },
    }));
  };

  // ── 步骤 4：确认排程 → 系统自动填充 ──
  const handleConfirmSetup = async () => {
    setIsSubmitting(true);
    try {
      const result = await setupDay({
        weekId,
        date: dateObj,
        isOpen: true,
        periodConfig: editConfig,
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
      setPhase("done");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 今天不学 ──
  const handleDayOff = async () => {
    await setupDay({ weekId, date: dateObj, isOpen: false });
    setPhase("idle");
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
    const period = findPeriodWithSpace(slots, initialPeriodConfig);
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

  // 当日总槽数
  const totalSlots = PERIODS.reduce(
    (sum, p) => sum + (editConfig[p].enabled ? editConfig[p].parentSlots : 0),
    0,
  );

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
              {todayActivities.map((a, i) => (
                <Badge key={`${a.name}-${i}`} variant="secondary" className="text-xs">
                  {a.name} {a.startTime}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {phase === "done" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPhase("setup")}
          >
            重新排程
          </Button>
        )}
      </div>

      {/* Warnings */}
      {consecutiveSlideWarning && (
        <Card className="p-3 bg-[#F59E0B]/10 border-[#F59E0B]/30">
          <p className="text-sm text-[#F59E0B]">
            连续 2 天非功课任务完成数为 0，建议关注
          </p>
        </Card>
      )}

      {/* Pending homeworks */}
      {pendingHomeworks.length > 0 && (
        <Card className="p-3 bg-[#F3C969]/10 border-[#F3C969]/30">
          <p className="text-xs text-[#F3C969] mb-1">待完成功课</p>
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

      {/* ════════════════════════════════════════════════ */}
      {/* PHASE: idle — 还没开始 */}
      {/* ════════════════════════════════════════════════ */}
      {phase === "idle" && (
        <div className="text-center py-12 space-y-4">
          <p className="text-[#CBD5E1]">今天要学习吗？</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setPhase("setup")}>
              开始计划
            </Button>
            <Button variant="outline" onClick={handleDayOff}>
              今天休息
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* PHASE: setup — 选时段、定槽数、加功课 */}
      {/* ════════════════════════════════════════════════ */}
      {phase === "setup" && (
        <div className="space-y-4">
          <Separator />

          {/* 步骤 1：选时段 + 步骤 2：定槽数 */}
          <div>
            <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-3">
              选择时段与槽数
            </h2>
            <div className="space-y-3">
              {PERIODS.map((period) => (
                <Card key={period} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={editConfig[period].enabled}
                        onCheckedChange={() => togglePeriod(period)}
                      />
                      <span className="text-sm font-medium">
                        {PERIOD_LABELS[period]}
                      </span>
                    </div>

                    {editConfig[period].enabled && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#CBD5E1]/50">
                          上限 {editConfig[period].maxSlots}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              setPeriodSlots(period, Math.max(0, editConfig[period].parentSlots - 1))
                            }
                            disabled={editConfig[period].parentSlots <= 0}
                            className="w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center bg-[#2a3a5c] text-[#CBD5E1] disabled:opacity-30"
                          >
                            -
                          </button>
                          <span className="text-sm font-semibold w-6 text-center">
                            {editConfig[period].parentSlots}
                          </span>
                          <button
                            onClick={() =>
                              setPeriodSlots(
                                period,
                                Math.min(editConfig[period].maxSlots, editConfig[period].parentSlots + 1),
                              )
                            }
                            disabled={editConfig[period].parentSlots >= editConfig[period].maxSlots}
                            className="w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center bg-[#1B998B]/30 text-[#5BC0BE] disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* 步骤 3：添加功课 */}
          <div>
            <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">
              今日功课（可选）
            </h2>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowHomeworkDialog(true)}
            >
              + 添加功课
            </Button>
          </div>

          {/* 汇总 + 确认 */}
          <Card className="p-4 bg-[#1B998B]/10 border-[#1B998B]/30">
            <p className="text-sm text-[#CBD5E1]">
              今日共 <span className="font-bold text-[#F1F5F9]">{totalSlots}</span> 个槽位
              {pendingHomeworks.length > 0 && (
                <span>，{pendingHomeworks.length} 项功课待排</span>
              )}
            </p>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setPhase("idle")}
            >
              返回
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmSetup}
              disabled={totalSlots === 0 || isSubmitting}
            >
              {isSubmitting ? "排程中..." : "确认排程"}
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* PHASE: done — 显示排程结果 */}
      {/* ════════════════════════════════════════════════ */}
      {phase === "done" && (
        <>
          <Separator />

          <div className="space-y-4">
            {PERIODS.map((period) => (
              <PeriodSection
                key={period}
                period={period}
                maxSlots={initialPeriodConfig[period].maxSlots}
                parentSlots={initialPeriodConfig[period].parentSlots}
                enabled={initialPeriodConfig[period].enabled}
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
                  <p className="text-xs text-[#CBD5E1]/40 py-2">暂无任务</p>
                )}
              </PeriodSection>
            ))}
          </div>

          {/* Bottom action bar */}
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
        </>
      )}

      {/* ── Dialogs ── */}

      {slideTarget && (
        <SlideDialog
          open={!!slideTarget}
          taskName={slideTarget.name}
          onClose={() => setSlideTarget(null)}
          onConfirm={handleSlide}
        />
      )}

      <AddHomeworkDialog
        open={showHomeworkDialog}
        onClose={() => setShowHomeworkDialog(false)}
        onAdd={handleAddHomework}
        defaultDate={date}
      />

      {showPinSelect && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center">
          <div className="bg-[#1C2541] rounded-t-2xl w-full max-w-lg p-4 pb-8 safe-area-bottom">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">选择任务</h3>
              <button
                onClick={() => setShowPinSelect(false)}
                className="text-[#CBD5E1]/50 text-lg"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleManualPin(t.id)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-[#0B132B] text-sm hover:bg-[#2a3a5c] active:bg-[#1B998B]/20"
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
