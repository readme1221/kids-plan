import { generateDaySchedule, computeWeekCapacity } from "../scheduler";
import { buildFillCandidates } from "../fill-priority";
import { computePeriodConfig } from "../activity-slots";
import type { TaskWithState, HomeworkInput, ActivityInput } from "../types";

// ── Test Helpers ──

function makeDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

const WEEK_END = makeDate(2026, 4, 5); // Sunday

function makeQuotaTask(overrides: Partial<TaskWithState> = {}): TaskWithState {
  return {
    taskConfigId: "task_1",
    name: "测试任务",
    taskType: "quota_weekly",
    weeklySlotBudget: 5,
    requiredSlots: null,
    fixedWeekdays: [],
    fixedPeriod: null,
    isActive: true,
    assignedCount: 0,
    doneCount: 0,
    progressStage: "not_started",
    carriedOverSlots: 0,
    isActiveThisWeek: true,
    ...overrides,
  };
}

// ── Tests ──

describe("computePeriodConfig", () => {
  it("returns default max slots when no activities", () => {
    const config = computePeriodConfig(1, []); // Monday, no activities
    expect(config.morning.maxSlots).toBe(3);
    expect(config.afternoon_early.maxSlots).toBe(3);
    expect(config.afternoon_late.maxSlots).toBe(3);
    expect(config.evening.maxSlots).toBe(2);
  });

  it("reduces maxSlots for period with activity", () => {
    const activities: ActivityInput[] = [
      {
        activityId: "a1",
        name: "游泳",
        dayOfWeek: 3,
        startTime: "16:00",
        endTime: "17:30",
        affectedPeriod: "afternoon_late",
        linkedTaskId: null,
        activeThisWeek: true,
      },
    ];
    const config = computePeriodConfig(3, activities); // Wednesday
    expect(config.afternoon_late.maxSlots).toBe(2); // 3 - 1
    expect(config.morning.maxSlots).toBe(3); // unaffected
  });

  it("ignores inactive activities", () => {
    const activities: ActivityInput[] = [
      {
        activityId: "a1",
        name: "游泳",
        dayOfWeek: 3,
        startTime: "16:00",
        endTime: "17:30",
        affectedPeriod: "afternoon_late",
        linkedTaskId: null,
        activeThisWeek: false,
      },
    ];
    const config = computePeriodConfig(3, activities);
    expect(config.afternoon_late.maxSlots).toBe(3); // no reduction
  });
});

describe("buildFillCandidates", () => {
  it("sorts daily deadline homework first", () => {
    const today = makeDate(2026, 4, 3);
    const tasks: TaskWithState[] = [
      makeQuotaTask({ taskConfigId: "t1", name: "数学" }),
    ];
    const homeworks: HomeworkInput[] = [
      {
        homeworkId: "hw1",
        title: "今日作业",
        deadlineType: "daily",
        deadlineDate: today,
        status: "pending",
      },
    ];

    const candidates = buildFillCandidates(tasks, homeworks, today, WEEK_END, new Set());
    expect(candidates[0].homeworkId).toBe("hw1");
    expect(candidates[0].priority).toBe(1); // DEADLINE_DAILY
    expect(candidates[1].taskConfigId).toBe("t1");
    expect(candidates[1].priority).toBe(4); // QUOTA_NORMAL
  });

  it("respects same-day no-repeat rule", () => {
    const today = makeDate(2026, 4, 3);
    const tasks: TaskWithState[] = [
      makeQuotaTask({ taskConfigId: "t1", name: "数学" }),
      makeQuotaTask({ taskConfigId: "t2", name: "英语" }),
    ];
    const alreadyScheduled = new Set(["t1"]); // t1 already scheduled today

    const candidates = buildFillCandidates(tasks, [], today, WEEK_END, alreadyScheduled);
    expect(candidates.length).toBe(1);
    expect(candidates[0].taskConfigId).toBe("t2");
  });

  it("places carried-over tasks at priority 3", () => {
    const today = makeDate(2026, 4, 3);
    const tasks: TaskWithState[] = [
      makeQuotaTask({ taskConfigId: "t1", name: "结转任务", carriedOverSlots: 2 }),
      makeQuotaTask({ taskConfigId: "t2", name: "正常任务" }),
    ];

    const candidates = buildFillCandidates(tasks, [], today, WEEK_END, new Set());
    expect(candidates[0].taskConfigId).toBe("t1");
    expect(candidates[0].priority).toBe(3); // CARRIED_OVER
    expect(candidates[1].taskConfigId).toBe("t2");
    expect(candidates[1].priority).toBe(4); // QUOTA_NORMAL
  });

  it("places completed_for_week tasks at priority 6", () => {
    const today = makeDate(2026, 4, 3);
    const tasks: TaskWithState[] = [
      makeQuotaTask({
        taskConfigId: "t1",
        name: "已完成",
        progressStage: "completed_for_week",
        doneCount: 5,
      }),
      makeQuotaTask({ taskConfigId: "t2", name: "正常" }),
    ];

    const candidates = buildFillCandidates(tasks, [], today, WEEK_END, new Set());
    expect(candidates[0].taskConfigId).toBe("t2"); // normal first
    expect(candidates[1].taskConfigId).toBe("t1"); // extra last
    expect(candidates[1].priority).toBe(6);
  });
});

describe("generateDaySchedule", () => {
  it("places fixed-time tasks first", () => {
    const today = makeDate(2026, 4, 4); // Saturday (dayOfWeek=6)
    const tasks: TaskWithState[] = [
      {
        ...makeQuotaTask({ taskConfigId: "t_piano_practice", name: "钢琴练习" }),
      },
      {
        taskConfigId: "t_piano_lesson",
        name: "钢琴课",
        taskType: "fixed_time",
        weeklySlotBudget: null,
        requiredSlots: null,
        fixedWeekdays: [6],
        fixedPeriod: "morning",
        isActive: true,
        assignedCount: 0,
        doneCount: 0,
        progressStage: "not_started",
        carriedOverSlots: 0,
        isActiveThisWeek: true,
      },
    ];

    const result = generateDaySchedule({
      date: today,
      dayOfWeek: 6,
      weekEndDate: WEEK_END,
      tasks,
      homeworks: [],
      activities: [],
      manualPins: [],
    });

    // Fixed-time task should be first and locked
    const fixedSlot = result.slots.find((s) => s.taskConfigId === "t_piano_lesson");
    expect(fixedSlot).toBeDefined();
    expect(fixedSlot!.sourceType).toBe("fixed_time");
    expect(fixedSlot!.isLocked).toBe(true);
    expect(fixedSlot!.period).toBe("morning");
  });

  it("auto-fills remaining slots", () => {
    const today = makeDate(2026, 4, 3);
    const tasks: TaskWithState[] = [
      makeQuotaTask({ taskConfigId: "t1", name: "数学", weeklySlotBudget: 4 }),
      makeQuotaTask({ taskConfigId: "t2", name: "英语", weeklySlotBudget: 3 }),
      makeQuotaTask({ taskConfigId: "t3", name: "阅读", weeklySlotBudget: 5 }),
    ];

    const result = generateDaySchedule({
      date: today,
      dayOfWeek: 5, // Friday
      weekEndDate: WEEK_END,
      tasks,
      homeworks: [],
      activities: [],
      manualPins: [],
    });

    // Should have filled slots (total default = 3+3+3+2 = 11)
    // But only 3 tasks, each can appear once per day
    const autoFilled = result.slots.filter((s) => s.sourceType === "auto_fill");
    expect(autoFilled.length).toBe(3); // one per task (same-day no-repeat)
  });

  it("warns on deadline risk", () => {
    const today = makeDate(2026, 4, 5); // Sunday = last day
    const tasks: TaskWithState[] = [
      {
        ...makeQuotaTask(),
        taskConfigId: "t_chinese",
        name: "华文听写",
        taskType: "deadline_weekly",
        weeklySlotBudget: null,
        requiredSlots: 2,
        doneCount: 0,
      },
    ];

    const result = generateDaySchedule({
      date: today,
      dayOfWeek: 0, // Sunday
      weekEndDate: WEEK_END,
      tasks,
      homeworks: [],
      activities: [],
      manualPins: [],
    });

    const deadlineWarning = result.warnings.find((w) => w.type === "deadline_risk");
    expect(deadlineWarning).toBeDefined();
    expect(deadlineWarning!.message).toContain("华文听写");
  });
});

describe("computeWeekCapacity", () => {
  it("returns normal when capacity > demand + 2", () => {
    const tasks: TaskWithState[] = [
      makeQuotaTask({ weeklySlotBudget: 3, doneCount: 0 }),
    ];
    const result = computeWeekCapacity({
      tasks,
      remainingDays: 5,
      totalRemainingSlots: 20,
      fixedTimeSlots: 2,
    });
    expect(result.status).toBe("normal");
    expect(result.remainingCapacity).toBe(18);
    expect(result.remainingDemand).toBe(3);
  });

  it("returns overloaded when capacity < demand", () => {
    const tasks: TaskWithState[] = [
      makeQuotaTask({ weeklySlotBudget: 10, doneCount: 0 }),
    ];
    const result = computeWeekCapacity({
      tasks,
      remainingDays: 2,
      totalRemainingSlots: 6,
      fixedTimeSlots: 0,
    });
    expect(result.status).toBe("overloaded");
  });

  it("excludes completed_for_week from demand (rule 8.13)", () => {
    const tasks: TaskWithState[] = [
      makeQuotaTask({
        weeklySlotBudget: 5,
        doneCount: 3,
        progressStage: "completed_for_week",
      }),
    ];
    const result = computeWeekCapacity({
      tasks,
      remainingDays: 3,
      totalRemainingSlots: 5,
      fixedTimeSlots: 0,
    });
    expect(result.remainingDemand).toBe(0); // excluded
    expect(result.status).toBe("normal");
  });
});
