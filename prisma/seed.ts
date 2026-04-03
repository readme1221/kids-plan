import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeon } from "@prisma/adapter-neon";

const url = process.env.DATABASE_URL!;
const isNeon = url.includes("neon.tech");
const adapter = isNeon
  ? new PrismaNeon({ connectionString: url })
  : new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 清除旧数据（按外键顺序）
  await prisma.executionLog.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.dayPlan.deleteMany();
  await prisma.weeklyTaskState.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.week.deleteMany();
  await prisma.taskConfig.deleteMany();

  // ─── TaskConfig：法案第 2 条任务总表 ─────────────────────

  // 截止型（日截止）
  await prisma.taskConfig.create({
    data: {
      id: "task_homework",
      name: "学校功课",
      taskType: "deadline_daily",
      isActive: true,
    },
  });

  // 截止型（周截止）
  await prisma.taskConfig.create({
    data: {
      id: "task_chinese_dictation",
      name: "华文听写",
      taskType: "deadline_weekly",
      requiredSlots: 2,
      isActive: true,
    },
  });

  // 固定时点型：钢琴练习 — 周三四六日傍晚，每周 4 slot
  await prisma.taskConfig.create({
    data: {
      id: "task_piano",
      name: "钢琴练习",
      taskType: "fixed_time",
      fixedWeekdays: [3, 4, 6, 0], // 周三、周四、周六、周日
      fixedPeriod: "afternoon_late",
      isActive: true,
    },
  });

  // 配额型任务（法案：配额型 14 slot/周）
  await prisma.taskConfig.create({
    data: {
      id: "task_english_tutor",
      name: "英文辅导",
      taskType: "quota_weekly",
      weeklySlotBudget: 2,
      isActive: true,
    },
  });

  await prisma.taskConfig.create({
    data: {
      id: "task_math_tutor",
      name: "数学辅导",
      taskType: "quota_weekly",
      weeklySlotBudget: 2,
      isActive: true,
    },
  });

  await prisma.taskConfig.create({
    data: {
      id: "task_ote_math",
      name: "OTE 数学",
      taskType: "quota_weekly",
      weeklySlotBudget: 2,
      isActive: true,
    },
  });

  await prisma.taskConfig.create({
    data: {
      id: "task_ote_english",
      name: "OTE 英文",
      taskType: "quota_weekly",
      weeklySlotBudget: 4,
      isActive: true,
    },
  });

  await prisma.taskConfig.create({
    data: {
      id: "task_science_tutor",
      name: "科学辅导",
      taskType: "quota_weekly",
      weeklySlotBudget: 2,
      isActive: true,
    },
  });

  await prisma.taskConfig.create({
    data: {
      id: "task_chinese_tutor",
      name: "华文辅导",
      taskType: "quota_weekly",
      weeklySlotBudget: 2,
      isActive: true,
    },
  });

  console.log("TaskConfig seeded (9 tasks per law v0.8.1)");

  // ─── Activity：法案第 2 条默认活动表 ──────────────────────

  // 钢琴课 — 周一 16:30-17:30 下午后，关联钢琴练习，autoLinkStop=false
  await prisma.activity.create({
    data: {
      id: "activity_piano",
      name: "钢琴课",
      dayOfWeek: 1,
      startTime: "16:30",
      endTime: "17:30",
      affectedPeriod: "afternoon_late",
      linkedTaskId: "task_piano",
      activeThisWeek: true,
      autoLinkStop: false, // 法案正式例外：钢琴课停课不自动停排钢琴练习
    },
  });

  // OTE 英文 — 周二 15:30-17:30 下午前+后（建模为两条，每段 -1）
  await prisma.activity.create({
    data: {
      id: "activity_ote_english_1",
      name: "OTE 英文",
      dayOfWeek: 2,
      startTime: "15:30",
      endTime: "17:30",
      affectedPeriod: "afternoon_early",
      linkedTaskId: "task_ote_english",
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });
  await prisma.activity.create({
    data: {
      id: "activity_ote_english_2",
      name: "OTE 英文",
      dayOfWeek: 2,
      startTime: "15:30",
      endTime: "17:30",
      affectedPeriod: "afternoon_late",
      linkedTaskId: "task_ote_english",
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });

  // 篮球 — 周三 17:30-18:30 下午后，无关联任务
  await prisma.activity.create({
    data: {
      id: "activity_basketball_wed",
      name: "篮球",
      dayOfWeek: 3,
      startTime: "17:30",
      endTime: "18:30",
      affectedPeriod: "afternoon_late",
      linkedTaskId: null,
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });

  // 英文补习 — 周三 19:00-20:00 晚上，关联英文辅导
  await prisma.activity.create({
    data: {
      id: "activity_english_tutor",
      name: "英文补习",
      dayOfWeek: 3,
      startTime: "19:00",
      endTime: "20:00",
      affectedPeriod: "evening",
      linkedTaskId: "task_english_tutor",
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });

  // OTE 数学 — 周四 18:45-20:30 晚上，关联 OTE 数学
  await prisma.activity.create({
    data: {
      id: "activity_ote_math",
      name: "OTE 数学",
      dayOfWeek: 4,
      startTime: "18:45",
      endTime: "20:30",
      affectedPeriod: "evening",
      linkedTaskId: "task_ote_math",
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });

  // 篮球 — 周六 13:00-14:00 下午前，无关联
  await prisma.activity.create({
    data: {
      id: "activity_basketball_sat",
      name: "篮球",
      dayOfWeek: 6,
      startTime: "13:00",
      endTime: "14:00",
      affectedPeriod: "afternoon_early",
      linkedTaskId: null,
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });

  // 篮球 — 周日 10:30-11:30 上午，无关联
  await prisma.activity.create({
    data: {
      id: "activity_basketball_sun_am",
      name: "篮球",
      dayOfWeek: 0,
      startTime: "10:30",
      endTime: "11:30",
      affectedPeriod: "morning",
      linkedTaskId: null,
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });

  // 篮球 — 周日 13:00-14:00 下午前，无关联
  await prisma.activity.create({
    data: {
      id: "activity_basketball_sun_pm",
      name: "篮球",
      dayOfWeek: 0,
      startTime: "13:00",
      endTime: "14:00",
      affectedPeriod: "afternoon_early",
      linkedTaskId: null,
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });

  console.log("Activity seeded (9 entries per law v0.8.1)");
  console.log("Seed completed!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
