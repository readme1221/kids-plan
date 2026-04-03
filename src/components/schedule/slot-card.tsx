"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SlotCardProps = {
  id: string;
  name: string;
  sourceType: string;
  isLocked: boolean;
  isCompleted?: boolean;
  onDone?: () => void;
  onSlide?: () => void;
};

const SOURCE_LABELS: Record<string, string> = {
  fixed_time: "固定",
  manual_pin: "手动",
  homework: "功课",
  auto_fill: "自动",
  locked: "锁定",
};

const SOURCE_COLORS: Record<string, string> = {
  fixed_time: "border-l-[#1B998B]",
  manual_pin: "border-l-[#F3C969]",
  homework: "border-l-[#F59E0B]",
  auto_fill: "border-l-[#2a3a5c]",
  locked: "border-l-[#1B998B]/60",
};

export function SlotCard({
  name,
  sourceType,
  isLocked,
  isCompleted,
  onDone,
  onSlide,
}: SlotCardProps) {
  return (
    <Card
      className={cn(
        "px-3 py-2.5 border-l-4 flex items-center justify-between",
        SOURCE_COLORS[sourceType] ?? "border-l-[#2a3a5c]",
        isCompleted && "opacity-50 bg-[#5BC0BE]/10",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "text-sm font-medium truncate",
            isCompleted && "line-through",
          )}
        >
          {name}
        </span>
        <span className="text-xs text-[#CBD5E1]/60 shrink-0">
          {SOURCE_LABELS[sourceType]}
        </span>
      </div>

      {!isCompleted && !isLocked && (
        <div className="flex gap-1 shrink-0 ml-2">
          {onDone && (
            <button
              onClick={onDone}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1B998B]/30 text-[#5BC0BE] text-lg active:bg-[#1B998B]/50"
              aria-label="完成"
            >
              ✓
            </button>
          )}
          {onSlide && (
            <button
              onClick={onSlide}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F59E0B]/20 text-[#F3C969] text-sm active:bg-[#F59E0B]/30"
              aria-label="滑移"
            >
              →
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
