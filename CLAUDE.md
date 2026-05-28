# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Couple Food Picker H5（“今天吃啥”）— 情侣互动点餐 H5/PWA。核心体验是：按日期生成同一天一致的“今日一句”和每日推荐，并支持情侣邀请码绑定后共享选择状态。

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

# 预览构建产物
npm run preview

# 部署（仅上传 dist）
bash deploy.sh

# 部署（全量：上传 server + 重装依赖 + 重启 Node）
bash deploy.sh --full

# 菜品数据脚本
npm run enrich:dishes
npm run generate:dishes
```

项目没有 ESLint、Prettier 或测试框架脚本。

## Architecture

**一体化部署**：Express 同时托管 `dist/` 静态文件和 `/api/*`，生产环境由同一个 Node 进程提供前后端。

```
浏览器 → nginx 反代 (serv00) → Express (:20531)
                                    ├── /api/* → MongoDB
                                    └── /* → SPA fallback (dist/index.html)
```

**前端主入口**：几乎所有 UI 和业务逻辑都在 `src/App.jsx`。页面通过本地 state 切换，不使用路由库。

**日期种子推荐**：`src/lib/dailyMenu.js` 提供菜品归一化、哈希选择和日期 key，同一天会返回同一份推荐/文案。

**双层持久化**：`src/lib/storage.js` 先读写 `localStorage`，再异步同步到 MongoDB。`usePersistentState` 负责普通状态，`useCoupleState` 负责情侣共享状态并通过长轮询同步。

**情侣绑定**：前端通过邀请码创建/加入 couple，绑定后使用 `coupleId + key` 共享选择结果；未绑定时仍按单人本地状态工作。

**后端模型**：
- `State`：`clientId + key + value + coupleId?`
- `Couple`：`coupleId + code + member1 + member2`

**后端 API**：
- `/api/health`
- `/api/state/:key`
- `/api/couple/create`
- `/api/couple/join`
- `/api/couple/status`
- `/api/couple-state/:coupleId/:key`

## Key Files

| 文件 | 作用 |
|------|------|
| `src/App.jsx` | 主 UI、随机推荐、今日食光、情侣绑定、共识弹窗 |
| `src/lib/storage.js` | 本地/远程状态同步 hooks |
| `src/lib/dailyMenu.js` | 菜品归一化、哈希选择、每日菜单生成 |
| `src/lib/api.js` | clientId、单人状态 API、情侣绑定 API |
| `server/index.mjs` | Express 入口、Mongoose 模型、API 路由 |
| `src/data/` | 菜品数据源 |

## Tech Stack

React 19 + Vite 7 + TailwindCSS 3.4 + Express 5 + Mongoose 8.16 + lucide-react

Node >= 22, npm >= 11, type: "module"

## Remote Server

serv00（FreeBSD），SSH alias：`s2serv00`，端口 `20531`，screen session：`couplefood`，域名：`https://igxshan.serv00.net/`

详见 `DEPLOY.md`。

## Notes

- 函数组件 + hooks，无类组件、无 TypeScript
- 样式使用 TailwindCSS utility classes
- 中文文案硬编码在组件中
- `deploy.sh` 在手动 scp/ssh 时优先使用显式远程路径 `s2serv00:~/app/couple-food-picker/...`，避免 shell 路径展开问题
