"use client";

import { cn } from "@/lib/utils";
import type { PeriodName } from "@/modules/shared/types";

type PeriodSectionProps = {
  period: PeriodName;
  maxSlots: number;
  parentSlots: number;
  enabled: boolean;
  children: React.ReactNode;
  onSlotsChange?: (slots: number) => void;
};

const PERIOD_LABELS: Record<PeriodName, string> = {
  morning: "上午",
  afternoon_early: "下午前",
  afternoon_late: "下午后",
  evening: "晚上",
};

const PERIOD_ICONS: Record<PeriodName, string> = {
  morning: "☀️",
  afternoon_early: "🌤️",
  afternoon_late: "🌅",
  evening: "🌙",
};

export function PeriodSection({
  period,
  maxSlots,
  parentSlots,
  enabled,
  children,
  onSlotsChange,
}: PeriodSectionProps) {
  if (!enabled) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span>{PERIOD_ICONS[period]}</span>
          <span className="text-sm font-medium">{PERIOD_LABELS[period]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">上限 {maxSlots}</span>
          {onSlotsChange && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSlotsChange(Math.max(0, parentSlots - 1))}
                disabled={parentSlots <= 0}
                className={cn(
                  "w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center",
                  parentSlots <= 0
                    ? "bg-[#2a3a5c]/50 text-[#CBD5E1]/30"
                    : "bg-[#2a3a5c] text-[#CBD5E1] active:bg-[#1B998B]/30",
                )}
              >
                -
              </button>
              <span className="text-sm font-semibold w-6 text-center">
                {parentSlots}
              </span>
              <button
                onClick={() =>
                  onSlotsChange(Math.min(maxSlots, parentSlots + 1))
                }
                disabled={parentSlots >= maxSlots}
                className={cn(
                  "w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center",
                  parentSlots >= maxSlots
                    ? "bg-[#2a3a5c]/50 text-[#CBD5E1]/30"
                    : "bg-[#1B998B]/30 text-[#5BC0BE] active:bg-[#1B998B]/50",
                )}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
