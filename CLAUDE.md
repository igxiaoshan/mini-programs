# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Couple Food Picker H5 ("今天吃啥") — 情侣互动点餐 H5/PWA 应用，帮助用户随机决定今天吃什么。

## Commands

```bash
# 开发（前端+后端同时启动）
npm run dev:full

# 仅前端（Vite 开发服务器，/api 代理到 localhost:3001）
npm run dev

# 仅后端
npm run server

# 生产构建
npm run build

# 部署（仅上传 dist）
bash deploy.sh

# 部署（全量：上传 server + 重装依赖 + 重启 Node）
bash deploy.sh --full

# 菜品数据脚本
npm run enrich:dishes      # 从 docs/ 爬取菜品到 crawledDishes.json
npm run generate:dishes     # 基于已有菜品生成变体到 generatedDishes.json
```

无 ESLint、Prettier、测试框架。

## Architecture

**一体化部署**: Express 同时托管前端静态文件 (dist/) 和后端 API (/api/*)，无需分别部署前后端。

```
浏览器 → nginx 反代 (serv00) → Express (:20531)
                                    ├── /api/* → MongoDB (State model: clientId + key + value)
                                    └── /* → SPA fallback (dist/index.html)
```

**后端极简**: `server/index.mjs` 仅89行，唯一 Model 是 `State` (clientId/key/value)，用于用户状态持久化。菜品数据不通过 API 提供。

**前端单文件**: 全部 UI 在 `src/App.jsx` (~930行)，仅 `DishCard` 为独立组件。视图通过 `tab` state 切换 (home/category/favorites/eaten/wheel)，无路由库。

**双层持久化**: `src/lib/storage.js` 的 `usePersistentState` hook — localStorage 优先读写 + 异步同步到 MongoDB（250ms debounce upsert）。clientId 为 localStorage 生成的 UUID。

**菜品数据流**: 4个 JSON 文件 (`src/data/`) 在构建时静态打包，启动时合并去重 → `normalizeDish()` 推断 tags/reason → `buildDailyMenu()` 用日期种子随机算法生成每日菜单（同一天所有人看到相同推荐）。

## Key Files

| 文件 | 作用 |
|------|------|
| `src/App.jsx` | 全部 UI + 逻辑 |
| `src/lib/storage.js` | usePersistentState (localStorage + 远程同步) |
| `src/lib/dailyMenu.js` | 菜品归一化、每日菜单生成、标签推断 |
| `src/lib/api.js` | fetchRemoteState / upsertRemoteState |
| `server/index.mjs` | Express 入口 + State Model + API 路由 |
| `src/data/dishes.json` | 手工基础菜品 |
| `src/data/generatedDishes.json` | 脚本生成的2500+变体菜品 |

## Tech Stack

React 19 + Vite 7 + TailwindCSS 3.4 + Express 5 + Mongoose 8.16 + lucide-react

Node >= 22, npm >= 11, type: "module"

## Remote Server

serv00 (FreeBSD), SSH alias: `s2serv00`, port 20531, screen session: `couplefood`, domain: https://igxshan.serv00.net/

详见 `DEPLOY.md`。

## Conventions

- 函数组件 + hooks，无类组件、无 TypeScript
- 样式全用 TailwindCSS utility classes
- 中文文案硬编码在组件中
- kind 枚举: `小吃` / `正餐` / `夜宵` / `奶茶` / `炸物`
- category 枚举: 由 dishes 数据中的 category 字段驱动