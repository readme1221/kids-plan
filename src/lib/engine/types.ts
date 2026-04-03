import type { Period, TaskType, ProgressStage, HomeworkStatus, HomeworkDeadlineType } from "@/generated/prisma/client";
import type { PeriodConfig } from "@/modules/shared/types";

/** 排程引擎输入：任务配置 + 本周状态 */
export type TaskWithState = {
  taskConfigId: string;
  name: string;
  taskType: TaskType;
  weeklySlotBudget: number | null;
  requiredSlots: number | null;
  fixedWeekdays: number[];
  fixedPeriod: Period | null;
  isActive: boolean;
  // WeeklyTaskState fields
  assignedCount: number;
  doneCount: number;
  progressStage: ProgressStage;
  carriedOverSlots: number;
  isActiveThisWeek: boolean;
};

/** 排程引擎输入：功课 */
export type HomeworkInput = {
  homeworkId: string;
  title: string;
  deadlineType: HomeworkDeadlineType;
  deadlineDate: Date;
  status: HomeworkStatus;
};

/** 排程引擎输入：活动 */
export type ActivityInput = {
  activityId: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  affectedPeriod: Period;
  linkedTaskId: string | null;
  activeThisWeek: boolean;
};

/** 填充候选项 */
export type FillCandidate = {
  type: "task" | "homework";
  taskConfigId?: string;
  homeworkId?: string;
  name: string;
  priority: number; // 1-6, lower = higher priority
  /** 用于同优先级内排序的分数，越高越优先 */
  urgencyScore: number;
};

/** 槽位分配结果 */
export type SlotAssignment = {
  period: Period;
  order: number;
  sourceType: "fixed_time" | "manual_pin" | "homework" | "auto_fill" | "locked";
  taskConfigId?: string;
  homeworkId?: string;
  isLocked: boolean;
};

/** 单日排程结果 */
export type DayScheduleResult = {
  date: Date;
  periodConfig: PeriodConfig;
  slots: SlotAssignment[];
  warnings: ScheduleWarning[];
};

export type ScheduleWarning = {
  type: "deadline_risk" | "slot_full" | "daily_deadline_conflict" | "fixed_time_auto_slot" | "consecutive_slide";
  message: string;
  taskConfigId?: string;
  homeworkId?: string;
};
