# frontend

前端工作台采用 **React + Vite + TypeScript** 作为第一版脚手架。

## 目标

先搭出一个可讨论、可演进的工作台骨架，而不是一开始就做完整业务逻辑。

当前页面重点体现：
- 顶部全局上下文
- 左侧对比组区域
- 中间 AI 对话与执行计划
- 右侧结果工作区（表格 / 图表 / 差异 / 报告）

## 本地启动

```bash
cd frontend
npm install
npm run dev
```

默认地址：
- <http://localhost:5173>

## 当前状态

- 仅包含静态页面与假数据
- 还未接入真实报表 API
- 后续将优先接入 `query-channel-report` 的标准化输出
