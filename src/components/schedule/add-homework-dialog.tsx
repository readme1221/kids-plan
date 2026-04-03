"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AddHomeworkDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (params: {
    title: string;
    deadlineType: "daily" | "weekly";
    deadlineDate: string;
  }) => void;
  defaultDate: string;
};

export function AddHomeworkDialog({
  open,
  onClose,
  onAdd,
  defaultDate,
}: AddHomeworkDialogProps) {
  const [title, setTitle] = useState("");
  const [deadlineType, setDeadlineType] = useState<"daily" | "weekly">("daily");
  const [deadlineDate, setDeadlineDate] = useState(defaultDate);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), deadlineType, deadlineDate });
    setTitle("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>添加功课</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <Label htmlFor="hw-title">功课名称</Label>
            <Input
              id="hw-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：数学作业 P23"
              autoFocus
            />
          </div>

          <div>
            <Label>截止类型</Label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setDeadlineType("daily")}
                className={`flex-1 py-2 rounded-lg text-sm ${
                  deadlineType === "daily"
                    ? "bg-[#F59E0B]/20 text-[#F59E0B] ring-2 ring-[#F59E0B]/50"
                    : "bg-[#1C2541] text-[#CBD5E1]/60"
                }`}
              >
                今日截止
              </button>
              <button
                onClick={() => setDeadlineType("weekly")}
                className={`flex-1 py-2 rounded-lg text-sm ${
                  deadlineType === "weekly"
                    ? "bg-[#F3C969]/20 text-[#F3C969] ring-2 ring-[#F3C969]/50"
                    : "bg-[#1C2541] text-[#CBD5E1]/60"
                }`}
              >
                本周截止
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="hw-date">截止日期</Label>
            <Input
              id="hw-date"
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              取消
            </Button>
            <Button
              className="flex-1"
              disabled={!title.trim()}
              onClick={handleSubmit}
            >
              添加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
