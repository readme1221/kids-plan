export { generateDaySchedule, computeWeekCapacity, computeSlotFullWarning } from "./scheduler";
export { computePeriodConfig, clampParentSlots, getTotalAvailableSlots } from "./activity-slots";
export { buildFillCandidates } from "./fill-priority";
export type {
  TaskWithState,
  HomeworkInput,
  ActivityInput,
  SlotAssignment,
  DayScheduleResult,
  ScheduleWarning,
  FillCandidate,
} from "./types";
