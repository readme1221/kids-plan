"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "green" | "red" | "yellow" | "blue" | "gray";
};

const COLOR_MAP = {
  green: "text-green-600",
  red: "text-red-600",
  yellow: "text-yellow-600",
  blue: "text-blue-600",
  gray: "text-gray-600",
};

export function StatCard({ title, value, subtitle, color = "blue" }: StatCardProps) {
  return (
    <Card className="p-3 text-center">
      <p className="text-xs text-gray-500">{title}</p>
      <p className={cn("text-2xl font-bold mt-1", COLOR_MAP[color])}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </Card>
  );
}
