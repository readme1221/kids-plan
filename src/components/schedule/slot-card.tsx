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
  fixed_time: "border-l-purple-500",
  manual_pin: "border-l-blue-500",
  homework: "border-l-red-500",
  auto_fill: "border-l-gray-300",
  locked: "border-l-purple-300",
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
        SOURCE_COLORS[sourceType] ?? "border-l-gray-200",
        isCompleted && "opacity-50 bg-green-50",
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
        <span className="text-xs text-gray-400 shrink-0">
          {SOURCE_LABELS[sourceType]}
        </span>
      </div>

      {!isCompleted && !isLocked && (
        <div className="flex gap-1 shrink-0 ml-2">
          {onDone && (
            <button
              onClick={onDone}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-green-50 text-green-600 text-lg active:bg-green-100"
              aria-label="完成"
            >
              ✓
            </button>
          )}
          {onSlide && (
            <button
              onClick={onSlide}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-orange-50 text-orange-500 text-sm active:bg-orange-100"
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
