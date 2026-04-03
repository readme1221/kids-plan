"use client";

import { cn } from "@/lib/utils";

type CapacityGaugeProps = {
  remainingCapacity: number;
  remainingDemand: number;
  status: "normal" | "tight" | "overloaded";
};

const STATUS_CONFIG = {
  normal: {
    label: "正常",
    color: "text-[#5BC0BE]",
    bg: "bg-[#1B998B]/15",
    border: "border-[#1B998B]/40",
  },
  tight: {
    label: "紧张",
    color: "text-[#F3C969]",
    bg: "bg-[#F3C969]/10",
    border: "border-[#F3C969]/30",
  },
  overloaded: {
    label: "超载",
    color: "text-[#F59E0B]",
    bg: "bg-[#F59E0B]/10",
    border: "border-[#F59E0B]/30",
  },
};

export function CapacityGauge({
  remainingCapacity,
  remainingDemand,
  status,
}: CapacityGaugeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={cn("rounded-xl p-4 border", config.bg, config.border)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#CBD5E1]">周容量</span>
        <span className={cn("text-sm font-bold", config.color)}>
          {config.label}
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-[#CBD5E1]">剩余容量</span>
          <span className="ml-1 font-semibold text-[#F1F5F9]">{remainingCapacity}</span>
        </div>
        <div>
          <span className="text-[#CBD5E1]">剩余需求</span>
          <span className="ml-1 font-semibold text-[#F1F5F9]">{remainingDemand}</span>
        </div>
      </div>
    </div>
  );
}
