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
    color: "text-green-400",
    bg: "bg-green-900/30",
    border: "border-green-800",
  },
  tight: {
    label: "紧张",
    color: "text-yellow-400",
    bg: "bg-yellow-900/30",
    border: "border-yellow-800",
  },
  overloaded: {
    label: "超载",
    color: "text-red-400",
    bg: "bg-red-900/30",
    border: "border-red-800",
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
        <span className="text-sm font-medium text-gray-300">周容量</span>
        <span className={cn("text-sm font-bold", config.color)}>
          {config.label}
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-gray-400">剩余容量</span>
          <span className="ml-1 font-semibold">{remainingCapacity}</span>
        </div>
        <div>
          <span className="text-gray-400">剩余需求</span>
          <span className="ml-1 font-semibold">{remainingDemand}</span>
        </div>
      </div>
    </div>
  );
}
