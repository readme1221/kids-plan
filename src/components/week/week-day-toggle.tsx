"use client";

import { cn } from "@/lib/utils";
import { getDayName } from "@/lib/time";

type WeekDayToggleProps = {
  dates: { date: Date; dayOfWeek: number; isOpen: boolean; isToday: boolean }[];
  onToggle: (date: Date, isOpen: boolean) => void;
};

export function WeekDayToggle({ dates, onToggle }: WeekDayToggleProps) {
  return (
    <div className="flex gap-1.5">
      {dates.map((d) => (
        <button
          key={d.date.toISOString()}
          onClick={() => onToggle(d.date, !d.isOpen)}
          className={cn(
            "flex-1 flex flex-col items-center py-2 rounded-lg text-xs transition-colors",
            d.isOpen
              ? "bg-[#1B998B] text-[#F1F5F9]"
              : "bg-[#1C2541] text-[#CBD5E1]/50",
            d.isToday && "ring-2 ring-[#F3C969]",
          )}
        >
          <span className="font-medium">{getDayName(d.dayOfWeek)}</span>
          <span className="text-xs mt-0.5">
            {d.date.getUTCDate()}
          </span>
        </button>
      ))}
    </div>
  );
}
