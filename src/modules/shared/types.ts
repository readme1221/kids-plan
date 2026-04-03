/**
 * PeriodConfig - DayPlan.periodConfig 的 TypeScript 类型
 * 必须严格遵守此结构（HANDOFF.md 7.6）
 */
export type PeriodSlotConfig = {
  enabled: boolean;
  maxSlots: number;
  parentSlots: number;
};

export type PeriodConfig = {
  morning: PeriodSlotConfig;
  afternoon_early: PeriodSlotConfig;
  afternoon_late: PeriodSlotConfig;
  evening: PeriodSlotConfig;
};

export const PERIODS = [
  "morning",
  "afternoon_early",
  "afternoon_late",
  "evening",
] as const;

export type PeriodName = (typeof PERIODS)[number];

/** 默认每个时段的最大槽位数（无活动占用时） */
export const DEFAULT_MAX_SLOTS: Record<PeriodName, number> = {
  morning: 3,
  afternoon_early: 3,
  afternoon_late: 3,
  evening: 2,
};

/** 六层自动填充优先级 */
export enum FillPriority {
  DEADLINE_DAILY = 1,
  DEADLINE_WEEKLY = 2,
  CARRIED_OVER = 3,
  QUOTA_NORMAL = 4,
  QUOTA_BUDGET_MET = 5,
  QUOTA_EXTRA = 6,
}
