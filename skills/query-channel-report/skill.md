# query-channel-report

## 目标

面向 AI 工作台提供统一的渠道报表查询能力。

这个 skill 不直接承载底层 API 细节，而是作为**项目级业务 skill**：
- 接收统一的查询 schema
- 在有账户组时先解析账户组
- 调用底层 `ad-manager-api` 能力构造请求并获取数据
- 返回前端和分析模块都可消费的结构化结果

底层 API/脚本说明见：`./ad-manager-api/SKILL.md`

---

## 定位

`query-channel-report` 是工作台里的**业务层报表查询 skill**。

### 它负责
- 接收统一查询参数
- 约束查询范围与默认值
- 将业务查询意图映射为底层报表请求
- 输出标准化结果结构

### 它不负责
- 直接维护 API 端点细节
- 直接暴露底层脚本使用方式给前端
- 承担素材分析、差异分析、报告生成

---

## 与 ad-manager-api 的关系

### 分层关系
- `ad-manager-api/`：底层 provider，负责报表 API 调用、字段映射、ID 映射、脚本执行
- `query-channel-report`：业务层 skill，负责统一输入输出和工作台接入

### 调用链路
用户请求 -> AI 编排层 -> `query-channel-report` -> `ad-manager-api` -> 报表 API -> 标准化结果 -> 前端/分析模块

---

## 输入 Schema

```json
{
  "groups": [
    {
      "group_id": "grp_a",
      "group_name": "A组",
      "account_ids": ["1001", "1002"]
    }
  ],
  "date_range": {
    "type": "last_n_days",
    "value": 7
  },
  "filters": {
    "project": [],
    "platform": [],
    "sub_channel": null,
    "device_os": null,
    "studio": [],
    "spread_type": null,
    "strategy": null,
    "account_id_list": []
  },
  "breakdown": "channel",
  "metrics": ["cost", "click", "ctr", "new_user", "roi1"],
  "sort": {
    "by": "cost",
    "order": "desc"
  },
  "pagination": {
    "page": 1,
    "page_size": 20
  },
  "income_type": "book",
  "query_mode": "standard"
}
```

---

## 字段说明

### groups
可选。用于赛马分析、组间对比等场景。

- 如果传入 `groups`，系统应优先使用组内 `account_ids` 进行查询。
- 第一版先支持**单组查询**和**多组分别查询后在上层做对比**。
- 后续可以扩展为真正的多组聚合查询。

### date_range
统一时间范围描述。

支持：
- `today`
- `yesterday`
- `last_n_days`
- `custom`
- `last_week`
- `this_month`

示例：

```json
{ "type": "last_n_days", "value": 7 }
```

或：

```json
{
  "type": "custom",
  "start_date": "2026-03-01",
  "end_date": "2026-03-07"
}
```

### filters
用于表达非组类筛选条件。

第一版建议支持：
- 项目
- 平台/渠道
- 子渠道
- 设备系统
- 工作室
- 推广类型
- 策略
- 账户 ID 列表

### breakdown
统一维度名，不直接暴露底层数字编码。

建议第一版支持：
- `day`
- `week`
- `month`
- `app`
- `platform`
- `channel`
- `account`
- `ad`
- `campaign`
- `studio`
- `strategy`

由本 skill 负责映射到底层 `dimension` 数值。

### metrics
查询指标列表。指标白名单由底层 `ad-manager-api/references/columns.md` 提供。

若未传，默认使用投放概览指标集：

```json
["cost", "show", "click", "ctr", "cvr", "new_user", "new_paid_user", "pay1", "roi1", "roi7", "total_roi", "stay2"]
```

### sort
统一排序结构：

```json
{
  "by": "cost",
  "order": "desc"
}
```

### pagination
统一分页结构：

```json
{
  "page": 1,
  "page_size": 20
}
```

### income_type
业务层语义值：
- `book` -> 底层 `income_type: 2`
- `net` -> 底层 `income_type: 1`

### query_mode
- `standard`：常规报表查询
- `hourly`：小时级查询

---

## 输出 Schema

```json
{
  "meta": {
    "query_type": "channel_report",
    "query_mode": "standard",
    "breakdown": "channel",
    "date_range": {
      "start_date": "2026-03-01",
      "end_date": "2026-03-07"
    },
    "filters": {},
    "groups": []
  },
  "columns": [
    { "key": "channel", "label": "渠道" },
    { "key": "cost", "label": "消耗" },
    { "key": "roi1", "label": "ROI1" }
  ],
  "rows": [],
  "totals": {},
  "group_summaries": [],
  "warnings": [],
  "raw_request": {},
  "raw_response_ref": ""
}
```

---

## 输出字段说明

### meta
描述本次查询的上下文，供前端顶部上下文卡片和分析模块复用。

### columns
结构化列定义，供表格/图表直接使用。

### rows
标准化后的结果行。

### totals
汇总结果。

### group_summaries
当存在多组查询时，用于输出每组的汇总摘要。

示例：

```json
[
  {
    "group_id": "grp_a",
    "group_name": "A组",
    "totals": {
      "cost": 12345,
      "new_user": 456,
      "roi1": 0.87
    }
  }
]
```

### warnings
记录：
- 用户条件不完整时的默认补全
- 名称无法精确映射时的提示
- 指标自动补齐/降级
- 数据口径提醒

### raw_request
底层实际请求体，方便调试与审计。

### raw_response_ref
原始响应存储引用，便于问题排查。

---

## 执行流程

### 1. 接收统一查询结构
AI 编排层将自然语言解析成 `query-channel-report` 的统一输入 schema。

### 2. 处理账户组
如果传入 `groups`：
- 从 group service 或上层上下文拿到 `account_ids`
- 优先将其映射到 `account_id_list`
- 第一版采用“按组分别查询”的策略，避免后端复杂聚合

### 3. 映射到底层 ad-manager-api 参数
包括：
- `date_range` -> `start_date/end_date` 或 `date`
- `breakdown` -> `dimension`
- `income_type` -> 数值
- `metrics` -> `column_list`
- `sort` -> `order_by/order_type`
- `filters` -> 对应底层筛选参数

### 4. 调用底层脚本/API
- 常规报表 -> `fetch-report.mjs`
- 小时报表 -> `fetch-hourly.mjs`

### 5. 结果标准化
将底层返回结果整理为：
- `columns`
- `rows`
- `totals`
- `warnings`
- `group_summaries`

### 6. 返回给前端与分析模块
供以下模块继续使用：
- 表格展示
- 图表展示
- 差异分析
- 报告生成

---

## 默认行为

### 默认维度
未指定时默认：`channel`

### 默认指标
未指定时使用投放概览指标集。

### 默认排序
未指定时：

```json
{
  "by": "cost",
  "order": "desc"
}
```

### 默认分页
未指定时：

```json
{
  "page": 1,
  "page_size": 20
}
```

### 默认收入类型
未指定时：`book`

### 默认时间范围
未指定时：`today`

---

## 典型场景

### 场景 1：单组渠道查询
“查询 A 组最近 7 天按渠道的消耗、CTR、ROI1。”

### 场景 2：项目级渠道查询
“看下欢乐钓鱼大师最近 14 天 Meta 的消耗和 ROI。”

### 场景 3：组间赛马前置查询
“分别查询 A 组和 B 组最近 7 天的渠道表现，后续做差异分析。”

### 场景 4：小时级查询
“看下今天欢乐钓鱼大师安卓端按小时的消耗。”

---

## 与后续技能的衔接

本 skill 是以下能力的上游输入：
- `compare-group-performance`
- `analyze-material-performance`
- `generate-analysis-report`

也就是说，后续分析 skill 不应该直接面向底层 API，而应优先消费 `query-channel-report` 的标准化输出。

---

## 当前限制（MVP）

- 第一版优先支持只读查询
- 多组对比采用“分组查询 + 上层汇总”，不强依赖底层直接 group by group
- 素材分析不在本 skill 内处理
- 复杂归因和跨数据源口径统一不在本 skill 内处理

---

## 参考

- 底层能力说明：`./ad-manager-api/SKILL.md`
- 字段说明：`./ad-manager-api/references/columns.md`
- 端点说明：`./ad-manager-api/references/endpoints.md`
- 筛选映射：`./ad-manager-api/references/filters.md`
