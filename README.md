# kids-plan

孩子每日学习计划 Dashboard

手机优先、规则驱动、家长覆盖自动系统例外的学习计划管理系统。

## 技术栈

- Next.js + TypeScript
- Tailwind CSS + shadcn/ui + dnd-kit
- Prisma + Vercel Postgres
- PWA

## 文档

- `HANDOFF.md` — 技术方案与实现规范（Code 的主入口）
- `docs/law_v081.pdf` — 法案 V0.8.1（业务规则权威来源）

## 开发

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## 规则

所有排程规则以法案为准。Code 不得擅自改动规则语义。如需调整，先改法案，再改代码。
