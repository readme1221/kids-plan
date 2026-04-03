"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ProgressStage, TaskType } from "@/generated/prisma/client";

type TaskState = {
  taskConfigId: string;
  name: string;
  taskType: TaskType;
  weeklySlotBudget: number | null;
  requiredSlots: number | null;
  doneCount: number;
  progressStage: ProgressStage;
  carriedOverSlots: number;
};

type SettleDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskStates: TaskState[];
  homeworkCount: { total: number; done: number; pending: number };
};

export function SettleDialog({
  open,
  onClose,
  onConfirm,
  taskStates,
  homeworkCount,
}: SettleDialogProps) {
  const [confirming, setConfirming] = useState(false);

  const quotaTasks = taskStates.filter((t) => t.taskType === "quota_weekly");
  const deadlineTasks = taskStates.filter((t) => t.taskType === "deadline_weekly");

  // 计算结转预览
  const carryOverPreview = quotaTasks.map((t) => {
    const budget = t.weeklySlotBudget ?? 0;
    const carry =
      t.progressStage === "completed_for_week"
        ? 0
        : Math.max(0, budget - t.doneCount);
    return { name: t.name, budget, doneCount: t.doneCount, carry };
  });

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>周结算确认</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[#CBD5E1]">
          结算后将关闭本周，创建下周计划。请确认以下摘要：
        </p>

        {/* 功课摘要 */}
        <Card className="p-3">
          <h3 className="text-xs font-medium text-[#CBD5E1]/60 mb-2">功课</h3>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-[#CBD5E1]/50 text-xs">总数</p>
              <p className="font-semibold">{homeworkCount.total}</p>
            </div>
            <div>
              <p className="text-[#CBD5E1]/50 text-xs">完成</p>
              <p className="font-semibold text-[#5BC0BE]">{homeworkCount.done}</p>
            </div>
            <div>
              <p className="text-[#CBD5E1]/50 text-xs">未完成</p>
              <p className={cn("font-semibold", homeworkCount.pending > 0 ? "text-[#F59E0B]" : "text-[#CBD5E1]/40")}>
                {homeworkCount.pending}
              </p>
            </div>
          </div>
          {homeworkCount.pending > 0 && (
            <p className="text-xs text-[#F59E0B] mt-1">
              未完成功课将标记为 overdue
            </p>
          )}
        </Card>

        {/* 截止型任务 */}
        {deadlineTasks.length > 0 && (
          <Card className="p-3">
            <h3 className="text-xs font-medium text-[#CBD5E1]/60 mb-2">截止型任务</h3>
            {deadlineTasks.map((t) => {
              const required = t.requiredSlots ?? 0;
              const met = t.doneCount >= required;
              return (
                <div key={t.taskConfigId} className="flex items-center justify-between text-sm py-1">
                  <span>{t.name}</span>
                  <span className={met ? "text-[#5BC0BE]" : "text-[#F59E0B]"}>
                    {t.doneCount}/{required} {met ? "✓" : "未达标"}
                  </span>
                </div>
              );
            })}
          </Card>
        )}

        {/* 配额型结转预览 */}
        <Card className="p-3">
          <h3 className="text-xs font-medium text-[#CBD5E1]/60 mb-2">配额型 → 下周结转</h3>
          <div className="space-y-1.5">
            {carryOverPreview.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <span>{t.name}</span>
                <span className="text-[#CBD5E1]/60">
                  {t.doneCount}/{t.budget}
                  {t.carry > 0 && (
                    <span className="text-[#F3C969] ml-1">→ 结转 {t.carry}</span>
                  )}
                  {t.carry === 0 && (
                    <span className="text-[#5BC0BE] ml-1">→ 不结转</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Separator />

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? "结算中..." : "确认结算"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
