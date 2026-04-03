import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ─── TaskConfig：默认任务表 ─────────────────────────────

  const pianoTask = await prisma.taskConfig.upsert({
    where: { id: "task_piano" },
    update: {},
    create: {
      id: "task_piano",
      name: "钢琴练习",
      taskType: "quota_weekly",
      weeklySlotBudget: 5,
      isActive: true,
    },
  });

  const readingTask = await prisma.taskConfig.upsert({
    where: { id: "task_reading" },
    update: {},
    create: {
      id: "task_reading",
      name: "阅读",
      taskType: "quota_weekly",
      weeklySlotBudget: 5,
      isActive: true,
    },
  });

  const mathTask = await prisma.taskConfig.upsert({
    where: { id: "task_math" },
    update: {},
    create: {
      id: "task_math",
      name: "数学练习",
      taskType: "quota_weekly",
      weeklySlotBudget: 4,
      isActive: true,
    },
  });

  const englishTask = await prisma.taskConfig.upsert({
    where: { id: "task_english" },
    update: {},
    create: {
      id: "task_english",
      name: "英语",
      taskType: "quota_weekly",
      weeklySlotBudget: 3,
      isActive: true,
    },
  });

  const chineseTask = await prisma.taskConfig.upsert({
    where: { id: "task_chinese_dictation" },
    update: {},
    create: {
      id: "task_chinese_dictation",
      name: "华文听写",
      taskType: "deadline_weekly",
      requiredSlots: 2,
      isActive: true,
    },
  });

  const pianoLesson = await prisma.taskConfig.upsert({
    where: { id: "task_piano_lesson" },
    update: {},
    create: {
      id: "task_piano_lesson",
      name: "钢琴课",
      taskType: "fixed_time",
      fixedWeekdays: [6], // 周六
      fixedPeriod: "morning",
      isActive: true,
    },
  });

  console.log("TaskConfig seeded:", {
    pianoTask: pianoTask.id,
    readingTask: readingTask.id,
    mathTask: mathTask.id,
    englishTask: englishTask.id,
    chineseTask: chineseTask.id,
    pianoLesson: pianoLesson.id,
  });

  // ─── Activity：默认活动表 ──────────────────────────────

  const pianoActivity = await prisma.activity.upsert({
    where: { id: "activity_piano_lesson" },
    update: {},
    create: {
      id: "activity_piano_lesson",
      name: "钢琴课",
      dayOfWeek: 6, // 周六
      startTime: "09:00",
      endTime: "10:00",
      affectedPeriod: "morning",
      linkedTaskId: "task_piano",
      activeThisWeek: true,
      autoLinkStop: false, // 钢琴课停课时不自动停排钢琴练习
    },
  });

  const swimmingActivity = await prisma.activity.upsert({
    where: { id: "activity_swimming" },
    update: {},
    create: {
      id: "activity_swimming",
      name: "游泳课",
      dayOfWeek: 3, // 周三
      startTime: "16:00",
      endTime: "17:30",
      affectedPeriod: "afternoon_late",
      linkedTaskId: null,
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });

  const artActivity = await prisma.activity.upsert({
    where: { id: "activity_art" },
    update: {},
    create: {
      id: "activity_art",
      name: "美术课",
      dayOfWeek: 5, // 周五
      startTime: "14:00",
      endTime: "15:30",
      affectedPeriod: "afternoon_early",
      linkedTaskId: null,
      activeThisWeek: true,
      autoLinkStop: true,
    },
  });

  console.log("Activity seeded:", {
    pianoActivity: pianoActivity.id,
    swimmingActivity: swimmingActivity.id,
    artActivity: artActivity.id,
  });

  console.log("Seed completed!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
