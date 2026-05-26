# Couple Food Picker H5 — 部署流程文档

## 1. 项目概述

- **项目名称**: couple-food-picker-h5
- **技术栈**: React 19 + Vite 7 + Express 5 + MongoDB (Mongoose)
- **架构**: SPA 前端 + Node.js 后端一体化部署（Express 同时托管静态文件和 API）
- **域名**: https://igxshan.serv00.net/
- **远程服务器**: serv00 (FreeBSD), SSH 别名 `s2serv00`

## 2. 本地开发

### 2.1 环境要求

- Node.js >= 22
- npm >= 11

### 2.2 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/couple_food_picker
```

### 2.3 启动开发服务器

```bash
# 前端 + 后端同时启动（Vite 开发服务器代理 /api 到 Express）
npm run dev:full

# 或分别启动
npm run dev      # 前端 Vite (localhost:5173, 代理 /api → localhost:3001)
npm run server   # 后端 Express (localhost:3001)
```

Vite 配置了开发代理：`/api` → `http://localhost:3001`（见 `vite.config.js`）。

## 3. 远程服务器环境

### 3.1 服务器信息

| 项目 | 值 |
|------|-----|
| 主机 | s2serv00 (serv00 FreeBSD) |
| Node.js | v22.22.2 |
| npm | 11.14.1 |
| MongoDB | mongo2.serv00.com:27017 |
| 应用端口 | 20531 |
| 进程管理 | screen (session: `couplefood`) |

### 3.2 远程目录结构

```
~/app/couple-food-picker/
├── .env                    # 环境变量（PORT=20531, MongoDB URI）
├── package.json            # 依赖声明
├── package-lock.json
├── node_modules/           # 生产依赖
├── server/
│   └── index.mjs           # Express 入口（托管 dist + API）
├── server.log              # 运行日志
└── dist/                   # Vite 构建产物（由本地上传）
    ├── index.html
    └── assets/
        ├── index-*.js
        └── index-*.css
```

### 3.3 远程 .env 配置

```
PORT=20531
MONGODB_URI=mongodb://mo4289_igxshan:<密码>@mongo2.serv00.com:27017/mo4289_igxshan
```

- `PORT=20531` — 避免与 serv00 系统端口冲突
- MongoDB 密码含特殊字符，已 URL 编码

### 3.4 反向代理

serv00 管理面板配置了 nginx 反向代理：

```
https://igxshan.serv00.net/ → localhost:20531
```

Express 响应头含 `x-powered-by: Express`，nginx 转发后保留。

## 4. 部署流程

### 4.1 首次部署（全新环境）

```bash
# 1. SSH 登录远程服务器
ssh s2serv00

# 2. 创建应用目录
mkdir -p ~/app/couple-food-picker

# 3. 上传项目代码（不含 node_modules 和 dist）
scp -r package.json package-lock.json server/ s2serv00:~/app/couple-food-picker/

# 4. 在远程安装生产依赖
ssh s2serv00 "cd ~/app/couple-food-picker && npm install --omit=dev"

# 5. 创建 .env 文件
ssh s2serv00 "cd ~/app/couple-food-picker && cat > .env << 'EOF'
PORT=20531
MONGODB_URI=mongodb://mo4289_igxshan:<密码>@mongo2.serv00.com:27017/mo4289_igxshan
EOF"

# 6. 本地构建并上传 dist
npm run build
scp -q -r dist/* s2serv00:~/app/couple-food-picker/dist/

# 7. 启动服务（screen 保持进程）
ssh s2serv00 "cd ~/app/couple-food-picker && screen -dmS couplefood node server/index.mjs"

# 8. 在 serv00 管理面板配置反向代理
#    WWW → Node.js → 端口 20531

# 9. 验证部署
curl -sf https://igxshan.serv00.net/api/health
```

### 4.2 增量部署（日常更新）

仅前端变更时：

```bash
# 1. 本地构建
npm run build

# 2. 清空远程 dist 并上传
ssh s2serv00 "rm -rf ~/app/couple-food-picker/dist/*"
scp -q -r dist/* s2serv00:~/app/couple-food-picker/dist/

# 3. 验证
curl -sf https://igxshan.serv00.net/api/health && echo " OK"
```

后端（server/）变更时：

```bash
# 1. 上传新 server 代码
scp -q server/index.mjs s2serv00:~/app/couple-food-picker/server/

# 2. 如有新依赖
ssh s2serv00 "cd ~/app/couple-food-picker && npm install --omit=dev"

# 3. 重启 Node 进程
ssh s2serv00 "screen -S couplefood -X quit; sleep 1; cd ~/app/couple-food-picker && screen -dmS couplefood node server/index.mjs"

# 4. 验证
curl -sf https://igxshan.serv00.net/api/health && echo " OK"
```

### 4.3 全量部署（依赖/结构变更）

```bash
# 1. 上传所有核心文件
scp -r package.json package-lock.json server/ s2serv00:~/app/couple-food-picker/

# 2. 远程重装依赖
ssh s2serv00 "cd ~/app/couple-food-picker && rm -rf node_modules && npm install --omit=dev"

# 3. 本地构建并上传 dist
npm run build
ssh s2serv00 "rm -rf ~/app/couple-food-picker/dist/*"
scp -q -r dist/* s2serv00:~/app/couple-food-picker/dist/

# 4. 重启服务
ssh s2serv00 "screen -S couplefood -X quit; sleep 1; cd ~/app/couple-food-picker && screen -dmS couplefood node server/index.mjs"

# 5. 验证
curl -sf https://igxshan.serv00.net/api/health && echo " OK"
```

## 5. 服务管理

### 5.1 常用操作

```bash
# 查看进程状态
ssh s2serv00 "screen -list"

# 进入 screen 会话（查看实时日志）
ssh s2serv00 "screen -r couplefood"
# 按 Ctrl+A, D 退出（不停止进程）

# 查看日志
ssh s2serv00 "cat ~/app/couple-food-picker/server.log"

# 重启服务
ssh s2serv00 "screen -S couplefood -X quit; sleep 1; cd ~/app/couple-food-picker && screen -dmS couplefood node server/index.mjs"

# 停止服务
ssh s2serv00 "screen -S couplefood -X quit"
```

### 5.2 带日志的启动方式

```bash
ssh s2serv00 "cd ~/app/couple-food-picker && screen -dmS couplefood node server/index.mjs > server.log 2>&1"
```

### 5.3 健康检查

```bash
curl -sf https://igxshan.serv00.net/api/health
# 成功返回: {"ok":true}
```

## 6. 故障排查

| 问题 | 排查步骤 |
|------|---------|
| 页面无响应 | `ssh s2serv00 "screen -list; curl -s http://localhost:20531/api/health"` |
| 502 / 空白页 | 检查 Node 进程是否存活；检查 dist 目录是否非空 |
| MongoDB 连接失败 | 检查 .env 中 MONGODB_URI 编码是否正确（特殊字符需 URL 编码） |
| API 返回 500 | `ssh s2serv00 "cat ~/app/couple-food-picker/server.log"` |
| 前端样式/JS 加载失败 | 检查 dist/assets/ 文件是否完整上传 |
| screen 会话丢失 | 重新启动：`screen -dmS couplefood node server/index.mjs` |

## 7. 架构说明

```
客户端浏览器
    ↓ HTTPS
nginx 反向代理 (serv00 管理)
    ↓ localhost:20531
Express (server/index.mjs)
    ├── /api/*        → MongoDB CRUD (mongoose)
    ├── /assets/*     → 静态文件 (dist/assets/)
    └── /*            → SPA fallback (dist/index.html)
```

Express 统一托管前端构建产物和后端 API，无需分别部署前端和后端服务。