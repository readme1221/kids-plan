"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTaskConfig,
  updateTaskConfig,
  deleteTaskConfig,
  createActivity,
  deleteActivity,
} from "@/server/actions/settings-actions";
import { updateActivity } from "@/server/actions/activity-actions";
import { getDayName } from "@/lib/time";
import { toast } from "sonner";
import type { TaskType, Period } from "@/generated/prisma/client";

const TYPE_LABELS: Record<TaskType, string> = {
  quota_weekly: "配额型",
  deadline_weekly: "周截止型",
  deadline_daily: "日截止型",
  fixed_time: "固定时点",
};

const PERIOD_LABELS: Record<string, string> = {
  morning: "上午",
  afternoon_early: "下午前",
  afternoon_late: "下午后",
  evening: "晚上",
};

type TaskData = {
  id: string;
  name: string;
  taskType: TaskType;
  weeklySlotBudget: number | null;
  requiredSlots: number | null;
  fixedWeekdays: number[];
  fixedPeriod: Period | null;
  isActive: boolean;
};

type ActivityData = {
  id: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  affectedPeriod: Period;
  linkedTaskId: string | null;
  linkedTaskName: string | null;
  activeThisWeek: boolean;
  autoLinkStop: boolean;
};

type Props = {
  tasks: TaskData[];
  activities: ActivityData[];
};

export function SettingsClient({ tasks, activities }: Props) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  // ── New task form state ──
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskType, setNewTaskType] = useState<TaskType>("quota_weekly");
  const [newTaskBudget, setNewTaskBudget] = useState("5");
  const [newTaskRequired, setNewTaskRequired] = useState("2");
  const [newTaskWeekdays, setNewTaskWeekdays] = useState<number[]>([]);
  const [newTaskPeriod, setNewTaskPeriod] = useState<Period>("morning");

  // ── New activity form state ──
  const [newActName, setNewActName] = useState("");
  const [newActDay, setNewActDay] = useState(1);
  const [newActStart, setNewActStart] = useState("09:00");
  const [newActEnd, setNewActEnd] = useState("10:00");
  const [newActPeriod, setNewActPeriod] = useState<Period>("morning");
  const [newActLinkedTask, setNewActLinkedTask] = useState("");
  const [newActAutoLink, setNewActAutoLink] = useState(true);

  const handleCreateTask = async () => {
    if (!newTaskName.trim()) return;
    await createTaskConfig({
      name: newTaskName.trim(),
      taskType: newTaskType,
      weeklySlotBudget: newTaskType === "quota_weekly" ? parseInt(newTaskBudget) : undefined,
      requiredSlots: newTaskType === "deadline_weekly" ? parseInt(newTaskRequired) : undefined,
      fixedWeekdays: newTaskType === "fixed_time" ? newTaskWeekdays : undefined,
      fixedPeriod: newTaskType === "fixed_time" ? newTaskPeriod : undefined,
    });
    setShowAddTask(false);
    setNewTaskName("");
    toast.success("任务已创建");
  };

  const handleToggleTask = async (id: string, isActive: boolean) => {
    await updateTaskConfig({ id, isActive });
    toast.success(isActive ? "已启用" : "已停用");
  };

  const handleCreateActivity = async () => {
    if (!newActName.trim()) return;
    await createActivity({
      name: newActName.trim(),
      dayOfWeek: newActDay,
      startTime: newActStart,
      endTime: newActEnd,
      affectedPeriod: newActPeriod,
      linkedTaskId: newActLinkedTask || undefined,
      autoLinkStop: newActAutoLink,
    });
    setShowAddActivity(false);
    setNewActName("");
    toast.success("活动已创建");
  };

  const handleToggleActivity = async (id: string, active: boolean) => {
    await updateActivity({
      activityId: id,
      updates: { activeThisWeek: active },
      weekId: "", // weekId is needed for linkage but toggle works without it for display
    });
    toast.success(active ? "已恢复" : "已停课");
  };

  const activeTasks = tasks.filter((t) => t.isActive);
  const inactiveTasks = tasks.filter((t) => !t.isActive);

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
      <h1 className="text-lg font-bold">设置</h1>

      {/* ── 任务配置 ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-500">任务配置</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddTask(true)}>
            + 新增
          </Button>
        </div>
        <div className="space-y-2">
          {activeTasks.map((t) => (
            <Card key={t.id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {TYPE_LABELS[t.taskType]}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {t.taskType === "quota_weekly" && `每周 ${t.weeklySlotBudget} 次`}
                    {t.taskType === "deadline_weekly" && `需完成 ${t.requiredSlots} 次`}
                    {t.taskType === "fixed_time" &&
                      `${t.fixedWeekdays.map(getDayName).join(", ")} ${PERIOD_LABELS[t.fixedPeriod ?? ""]}`}
                  </p>
                </div>
                <Switch
                  checked={t.isActive}
                  onCheckedChange={(v) => handleToggleTask(t.id, v)}
                />
              </div>
            </Card>
          ))}
          {inactiveTasks.length > 0 && (
            <details className="text-sm">
              <summary className="text-gray-400 cursor-pointer">
                已停用 ({inactiveTasks.length})
              </summary>
              <div className="space-y-2 mt-2">
                {inactiveTasks.map((t) => (
                  <Card key={t.id} className="p-3 opacity-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{t.name}</span>
                      <Switch
                        checked={false}
                        onCheckedChange={() => handleToggleTask(t.id, true)}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      <Separator />

      {/* ── 课外活动 ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-500">课外活动</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddActivity(true)}>
            + 新增
          </Button>
        </div>
        <div className="space-y-2">
          {activities.map((a) => (
            <Card key={a.id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {getDayName(a.dayOfWeek)} {a.startTime}-{a.endTime}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {PERIOD_LABELS[a.affectedPeriod]}
                    {a.linkedTaskName && ` · 关联: ${a.linkedTaskName}`}
                    {!a.autoLinkStop && " · 停课不停排"}
                  </p>
                </div>
                <Switch
                  checked={a.activeThisWeek}
                  onCheckedChange={(v) => handleToggleActivity(a.id, v)}
                />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Add Task Dialog ── */}
      <Dialog open={showAddTask} onOpenChange={(v) => !v && setShowAddTask(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新增任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>名称</Label>
              <Input value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="任务名称" />
            </div>
            <div>
              <Label>类型</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(["quota_weekly", "deadline_weekly", "fixed_time"] as TaskType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNewTaskType(type)}
                    className={`py-2 rounded-lg text-xs ${
                      newTaskType === type ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300" : "bg-gray-50"
                    }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
            {newTaskType === "quota_weekly" && (
              <div>
                <Label>每周预算</Label>
                <Input type="number" value={newTaskBudget} onChange={(e) => setNewTaskBudget(e.target.value)} />
              </div>
            )}
            {newTaskType === "deadline_weekly" && (
              <div>
                <Label>所需次数</Label>
                <Input type="number" value={newTaskRequired} onChange={(e) => setNewTaskRequired(e.target.value)} />
              </div>
            )}
            {newTaskType === "fixed_time" && (
              <>
                <div>
                  <Label>星期</Label>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <button
                        key={d}
                        onClick={() =>
                          setNewTaskWeekdays((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                          )
                        }
                        className={`w-9 h-9 rounded-full text-xs ${
                          newTaskWeekdays.includes(d)
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {getDayName(d).slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>时段</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(["morning", "afternoon_early", "afternoon_late", "evening"] as Period[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setNewTaskPeriod(p)}
                        className={`py-2 rounded-lg text-xs ${
                          newTaskPeriod === p ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300" : "bg-gray-50"
                        }`}
                      >
                        {PERIOD_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Button className="w-full" disabled={!newTaskName.trim()} onClick={handleCreateTask}>
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Activity Dialog ── */}
      <Dialog open={showAddActivity} onOpenChange={(v) => !v && setShowAddActivity(false)}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增课外活动</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>名称</Label>
              <Input value={newActName} onChange={(e) => setNewActName(e.target.value)} placeholder="活动名称" />
            </div>
            <div>
              <Label>星期几</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <button
                    key={d}
                    onClick={() => setNewActDay(d)}
                    className={`w-9 h-9 rounded-full text-xs ${
                      newActDay === d ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {getDayName(d).slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>开始</Label>
                <Input type="time" value={newActStart} onChange={(e) => setNewActStart(e.target.value)} />
              </div>
              <div>
                <Label>结束</Label>
                <Input type="time" value={newActEnd} onChange={(e) => setNewActEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>影响时段</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(["morning", "afternoon_early", "afternoon_late", "evening"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewActPeriod(p)}
                    className={`py-2 rounded-lg text-xs ${
                      newActPeriod === p ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300" : "bg-gray-50"
                    }`}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>关联任务（可选）</Label>
              <select
                value={newActLinkedTask}
                onChange={(e) => setNewActLinkedTask(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-gray-50 border rounded-lg"
              >
                <option value="">不关联</option>
                {tasks.filter((t) => t.isActive).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <Label>停课时自动停排关联任务</Label>
              <Switch checked={newActAutoLink} onCheckedChange={setNewActAutoLink} />
            </div>
            <Button className="w-full" disabled={!newActName.trim()} onClick={handleCreateActivity}>
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
