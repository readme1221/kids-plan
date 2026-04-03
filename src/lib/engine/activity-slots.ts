import type { ActivityInput } from "./types";
import { PERIODS, DEFAULT_MAX_SLOTS, type PeriodConfig, type PeriodName } from "@/modules/shared/types";

/**
 * 活动占槽计算（规则 8.11）
 * 活动占槽先于家长手动定槽。系统先按活动表计算各时段 maxSlots。
 *
 * 策略：每个时段有活动时，maxSlots 减少。
 * 简化假设：一个活动占用其 affectedPeriod 的 1 个槽位。
 */
export function computePeriodConfig(
  dayOfWeek: number,
  activities: ActivityInput[],
): PeriodConfig {
  // 筛选当天生效的活动
  const todayActivities = activities.filter(
    (a) => a.dayOfWeek === dayOfWeek && a.activeThisWeek,
  );

  const config: PeriodConfig = {} as PeriodConfig;

  for (const period of PERIODS) {
    const defaultMax = DEFAULT_MAX_SLOTS[period];
    // 计算该时段被活动占用的槽位数
    const occupiedByActivities = todayActivities.filter(
      (a) => a.affectedPeriod === period,
    ).length;
    const maxSlots = Math.max(0, defaultMax - occupiedByActivities);

    config[period] = {
      enabled: true,
      maxSlots,
      parentSlots: maxSlots, // 默认等于 maxSlots，家长可以下调
    };
  }

  return config;
}

/**
 * 校验并调整家长设定的槽数（规则 8.11）
 * parentSlots 不得超过 maxSlots。
 * 若活动临时新增导致已设槽数超限，自动下调至上限。
 * 返回是否有下调发生。
 */
export function clampParentSlots(config: PeriodConfig): {
  config: PeriodConfig;
  clamped: boolean;
} {
  let clamped = false;
  const result = { ...config };

  for (const period of PERIODS) {
    const p = result[period];
    if (p.parentSlots > p.maxSlots) {
      result[period] = { ...p, parentSlots: p.maxSlots };
      clamped = true;
    }
  }

  return { config: result, clamped };
}

/**
 * 计算当日总可用槽数
 */
export function getTotalAvailableSlots(config: PeriodConfig): number {
  let total = 0;
  for (const period of PERIODS) {
    if (config[period].enabled) {
      total += config[period].parentSlots;
    }
  }
  return total;
}
