"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type SlideReason =
  | "time_insufficient"
  | "child_gave_up"
  | "parent_manual"
  | "fixed_missed"
  | "deadline_expired";

type SlideDialogProps = {
  open: boolean;
  taskName: string;
  onClose: () => void;
  onConfirm: (reason: SlideReason) => void;
};

const REASONS: { value: SlideReason; label: string }[] = [
  { value: "time_insufficient", label: "时间不够" },
  { value: "child_gave_up", label: "孩子放弃" },
  { value: "parent_manual", label: "家长调整" },
  { value: "fixed_missed", label: "错过固定时间" },
  { value: "deadline_expired", label: "已过截止" },
];

export function SlideDialog({
  open,
  taskName,
  onClose,
  onConfirm,
}: SlideDialogProps) {
  const [selected, setSelected] = useState<SlideReason | null>(null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>滑移原因</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 mb-3">
          「{taskName}」未完成，请选择原因：
        </p>
        <div className="space-y-2">
          {REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                selected === r.value
                  ? "bg-orange-100 text-orange-700 ring-2 ring-orange-300"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button
            className="flex-1"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
          >
            确认滑移
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
