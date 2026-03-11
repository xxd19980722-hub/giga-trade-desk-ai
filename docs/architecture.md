# Architecture

## 核心分层

1. 前端工作台
2. AI 编排层
3. Skill Registry
4. 数据查询/分析服务
5. 数据源与属性表

## 第一版核心链路

用户提问 -> AI 解析意图 -> 调用业务层 `query-channel-report` -> 业务层映射到底层 `ad-manager-api` -> 返回结构化结果 -> 触发分析 -> 生成摘要/报告

## 当前实现建议

- `query-channel-report` 作为工作台统一报表查询 skill
- `ad-manager-api` 作为底层 provider，负责 API 调用和字段/筛选映射
- 前端与后续分析 skill 优先消费标准化结果，而不是直接消费底层 API 原始返回
