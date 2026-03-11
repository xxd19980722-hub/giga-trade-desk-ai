# giga-trade-desk-ai

一个面向广告赛马分析的 AI 工作台 MVP。

当前目标：
- 定义账户组
- 查询渠道/投放报表
- 做多组对比
- 做素材分析
- 生成分析报告

## 当前目录结构

- `docs/`：产品、架构、数据结构文档
- `skills/`：技能定义与示例
- `mock/`：本地 mock 数据
- `frontend/`：前端工作台（React + Vite + TS）
- `backend/`：本地 API 桥接层

## 本地启动

### 1. 启动 backend

```bash
export AD_MANAGER_TOKEN="你的 token"
cd backend
npm run dev
```

默认监听：
- `http://localhost:8787`
- 同时监听 `0.0.0.0:8787`，可供局域网访问

### 2. 启动 frontend

```bash
cd frontend
npm install
npm run dev
```

默认监听：
- `http://localhost:5173`
- 同时监听 `0.0.0.0:5173`，可供局域网访问

## 局域网预览

同事在同一局域网内时，可通过你的电脑局域网 IP 访问前端，例如：

```text
http://192.168.x.x:5173
```

页面会自动把 backend 请求发到同一台主机的 `8787` 端口，因此通常只需要：

```text
http://你的局域网IP:5173
```

> 注意：当前版本为了便于演示，未做 token 与权限收敛。仅建议在可信局域网中临时预览。

## 页面内测试

打开页面后，点击：
- `加载真实数据`

这会走通：
- 前端 -> backend
- backend -> `query-channel-report` 底层脚本
- `ad-manager-api` -> 真实报表 API
- 返回结果到前端表格

## 下一步

1. 把当前本地 API 包装成正式的 `query-channel-report` 服务层
2. 接入账户组与真实赛马查询条件
3. 扩展素材维度查询与组间对比
