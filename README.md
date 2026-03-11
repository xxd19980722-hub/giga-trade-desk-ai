# giga-trace-desk-ai

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

## 前端本地测试

### 1. 启动 backend
需要先设置 token：

```bash
export AD_MANAGER_TOKEN="你的 token"
cd backend
npm run dev
```

默认监听：
- <http://localhost:8787>

### 2. 启动 frontend

```bash
cd frontend
npm install
npm run dev
```

默认地址：
- <http://localhost:5173>

### 3. 在页面里测试
打开页面后，点击：
- `加载真实数据`

这会走通：
- 前端 -> `/api/report/platform`
- backend -> `query-channel-report` 底层脚本
- `ad-manager-api` -> 真实报表 API
- 返回结果到前端表格

## 下一步

1. 把当前本地 API 包装成正式的 `query-channel-report` 服务层
2. 接入账户组与真实赛马查询条件
3. 扩展素材维度查询与组间对比
