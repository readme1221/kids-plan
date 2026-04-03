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
  green: "text-[#5BC0BE]",
  red: "text-[#F59E0B]",
  yellow: "text-[#F3C969]",
  blue: "text-[#1B998B]",
  gray: "text-[#CBD5E1]",
};

export function StatCard({ title, value, subtitle, color = "blue" }: StatCardProps) {
  return (
    <Card className="p-3 text-center">
      <p className="text-xs text-[#CBD5E1]/60">{title}</p>
      <p className={cn("text-2xl font-bold mt-1", COLOR_MAP[color])}>{value}</p>
      {subtitle && <p className="text-xs text-[#CBD5E1]/50 mt-0.5">{subtitle}</p>}
    </Card>
  );
}
