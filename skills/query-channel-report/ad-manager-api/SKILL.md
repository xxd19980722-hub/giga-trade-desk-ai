---
name: ad-manager-api
description: 根据自然语言查询需求构造请求参数并调用广告管理报表 API 获取投放数据。当用户提到以下关键词时触发：查数据、报表、投放数据、消耗/花费、ROI、新增、留存、付费、LTV、ARPPU、成本、DAU、内购流水、广告收入、按渠道/按天/按账户看、某个项目名称（如"欢乐钓鱼大师"）、某个平台名称（如"头条""快手""广点通"）、分小时、小时级、按小时看、每小时消耗、小时趋势。
---

# Ad Manager 报表 API

通过自然语言描述查询需求，自动构造请求参数并调用 Ad Manager 报表 API。

使用前先读取 [references/endpoints.md](references/endpoints.md) 获取端点定义，读取 [references/columns.md](references/columns.md) 获取可用指标字段，读取 [references/filters.md](references/filters.md) 获取筛选参数的 ID 映射。

## API 基本信息

- Base URL: `https://pt09-tradedesk-online.tuyoo.com/api/ad-manager/report/v1`
- 认证: `authorization` header，值为 JWT token
- Content-Type: `application/json`
- 方法: POST

## Token 获取

Token 从环境变量 `AD_MANAGER_TOKEN` 读取。若未设置，提示用户设置：
```bash
export AD_MANAGER_TOKEN="your_jwt_token_here"
```

## 工作流程

1. **解析用户意图**: 识别时间范围、关注指标、维度、排序需求
2. **构造请求参数**: 按规则映射为 JSON 请求体
3. **执行调用**: 使用 `scripts/fetch-report.mjs` 执行请求
4. **格式化输出**: 将结果以表格或结构化形式展示

## 参数构造规则

### 日期范围 (start_date / end_date)

格式 `YYYY-MM-DD`，根据自然语言解析：

| 用户表述 | start_date | end_date |
|---------|-----------|---------|
| 今天 | 当天日期 | 当天日期 |
| 昨天 | 昨天日期 | 昨天日期 |
| 最近 N 天 | 当天 - (N-1) 天 | 当天 |
| 上周 | 上周一 | 上周日 |
| 本月 | 本月1日 | 当天 |
| 具体日期 2026-02-20 | 2026-02-20 | 2026-02-20 |
| 日期区间 2/20-2/28 | 2026-02-20 | 2026-02-28 |

未指定日期时默认为**今天**。

### 维度 (dimension)

| 值 | 含义 | 用户表述示例 |
|----|------|-------------|
| 1 | 日 | "按天看"、"每日趋势" |
| 2 | 月 | "按月看"、"月度汇总" |
| 3 | 投放应用 | "按应用看"、"各应用" |
| 4 | 子平台 | "按子平台" |
| 5 | 渠道 | "按渠道看"、"各渠道" |
| 6 | 计划名 | "按计划名" |
| 7 | 计划ID | "按计划ID" |
| 8 | 账户名称 | "按账户看"、"各账户" |
| 9 | 账户ID | "按账户ID" |
| 10 | 广告名称 | "按广告看"、"各广告" |
| 11 | 广告ID | "按广告ID" |
| 12 | 营销工作室 | "按工作室" |
| 13 | 优化师 | "按优化师" |
| 14 | 二级渠道 | "按二级渠道" |
| 15 | 推广类型 | "按推广类型" |
| 16 | 账户备注 | "按账户备注" |
| 17 | 代理商 | "按代理商" |
| 18 | 营销组 | "按营销组" |
| 19 | 投放策略 | "按投放策略" |
| 20 | 开户主体 | "按开户主体" |
| 21 | 周 | "按周看"、"每周汇总" |

用户未指定维度时默认 `dimension: 5`（渠道）。

### 收入类型 (income_type)

| 值 | 含义 | 用户表述示例 |
|----|------|-------------|
| 1 | 净收入 | "净收入"、"扣量后" |
| 2 | 账面收入 | "账面收入"、"账面" |

用户未指定时默认 `income_type: 2`（账面收入）。

### 指标字段 (column_list)

根据用户关注的指标选择字段子集。完整字段列表见 [references/columns.md](references/columns.md)。

常用分组：
- **投放数据**: `cost`, `show`, `click`, `convert`, `active`, `ctr`, `cvr`
- **成本效率**: `convert_cost`, `active_cost`, `cost_by_thousand_show`, `new_user_cost`, `new_paid_user_cost`
- **用户**: `new_user`, `new_paid_user`, `new_paid_rate`, `new_user_ad_trace`, `advertiser_dau`
- **付费**: `pay1`~`pay360`, `total_pay`, `pay3_1`, `pay7_1`, `arppu_1`, `advertiser_recharge`, `income`
- **LTV**: `ltv1`~`ltv360`, `total_ltv`
- **ROI**: `roi1`~`roi360`, `total_roi`
- **留存率**: `stay2`~`stay180`；留存人数: `stay_num2`~`stay_num180`
- **付费留存**: `pay2_stay_rate`, `pay3_stay_rate`, `pay7_stay_rate`
- **活跃天数**: `times3`~`times7`

payN / ltvN / roiN / stayN 支持的天数节点: 1-15, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300, 360（roi 从 roi1 到 roi7 连续，之后跳到 roi15）。

用户未明确指定指标时，使用投放概览默认组合：
```json
["cost","show","click","ctr","cvr","new_user","new_paid_user","pay1","roi1","roi7","total_roi","stay2"]
```

### 排序 (order_by / order_type)

- `order_by`: 排序字段名，须为 `column_list` 中的字段
- `order_type`: `asc` 升序 / `desc` 降序

| 用户表述 | order_by | order_type |
|---------|---------|-----------|
| 按花费排序 / 花费最多 | cost | desc |
| 按 ROI 排序 | roi1 | desc |
| 新增最少 | new_user | asc |

未指定排序时默认 `order_by: "cost"`, `order_type: "desc"`。

### 分页 (page / page_size)

- 默认 `page: 1`, `page_size: 20`
- 用户说"前 50 条" → `page_size: 50`
- 用户说"第 2 页" → `page: 2`

### 筛选条件（可选参数）

用户提到筛选条件时才加入对应字段，未提及则**不传**。

| 参数 | 类型 | 用户表述示例 |
|------|------|-------------|
| project | string[] | "欢乐钓鱼大师" → `["9420"]`，ID 映射见 filters.md |
| platform | string[] | "头条" → `["1"]`，"快手" → `["2"]`，ID 映射见 filters.md |
| sub_channel | string | "子渠道4" → `"4"` |
| device_os | number | "iOS" / "安卓" → 对应数值 |
| studio | string[] | "工作室1" → `["1"]` |
| spread_type | string | "推广类型1" → `"1"` |
| account_id_list | string[] | "账户 1233323" → `["1233323"]` |
| strategy | number | "自动投放" → `2`，"手动投放" → `1` |

筛选参数的值为 ID，用户使用名称时查 [references/filters.md](references/filters.md) 转换为 ID。无法匹配时提示确认。

## 端点选择规则

本 skill 包含两个端点，根据用户意图选择：

| 用户意图 | 脚本 | 端点 | 说明 |
|---------|------|------|------|
| 常规报表（按天/按渠道/按账户等） | `fetch-report.mjs` | `/api/ad-manager/report/v1/platform/` | 支持多维度、分页、排序、自选指标 |
| 分小时数据（小时级消耗/趋势） | `fetch-hourly.mjs` | `/api/ad-manager/platform/v1/hourly_data/data/` | 单日每小时明细，固定返回字段 |

**判断关键词：** 用户提到"分小时""小时级""按小时看""每小时""小时趋势""小时消耗"时，使用分小时端点。

## 执行方式

### 常规报表（fetch-report.mjs）

```bash
node scripts/fetch-report.mjs --endpoint platform --body '{"page":1,"page_size":20,"start_date":"2026-02-28","end_date":"2026-02-28","order_by":"cost","order_type":"desc","dimension":5,"income_type":1,"column_list":["cost","new_user","roi1"]}'
```

### 分小时报表（fetch-hourly.mjs）

```bash
node scripts/fetch-hourly.mjs --body '{"date":"2026-03-02","project_id":2,"platform":1,"sub_channel":4,"device_os":1}'
```

脚本路径相对于本 skill 目录：`.cursor/skills/ad-manager-api/scripts/`

## 自然语言映射示例

**示例 1**: "查一下今天的投放数据"

```json
{
  "page": 1,
  "page_size": 20,
  "start_date": "2026-02-28",
  "end_date": "2026-02-28",
  "order_by": "cost",
  "order_type": "desc",
  "dimension": 5,
  "income_type": 2,
  "column_list": ["cost","new_user","new_paid_user","pay1","roi1","roi7","total_roi","arppu_1","advertiser_recharge","stay2","new_user_cost","new_paid_user_cost","pay2_stay_rate","pay7_stay_rate","new_user_ad_trace","pay1_ad_trace","pay7_ad_trace"]
}
```

**示例 2**: "最近 7 天花费最多的前 10 条，只看花费和 ROI"

```json
{
  "page": 1,
  "page_size": 10,
  "start_date": "2026-02-22",
  "end_date": "2026-02-28",
  "order_by": "cost",
  "order_type": "desc",
  "dimension": 5,
  "income_type": 2,
  "column_list": ["cost","roi1","roi7","total_roi"]
}
```

**示例 3**: "昨天新增用户最多的，看新增和留存"

```json
{
  "page": 1,
  "page_size": 20,
  "start_date": "2026-02-27",
  "end_date": "2026-02-27",
  "order_by": "new_user",
  "order_type": "desc",
  "dimension": 5,
  "income_type": 2,
  "column_list": ["new_user","new_user_ad_trace","stay2","pay2_stay_rate","pay7_stay_rate"]
}
```

**示例 4**: "项目2、iOS端、今天的花费和ROI数据"

```json
{
  "page": 1,
  "page_size": 20,
  "start_date": "2026-02-28",
  "end_date": "2026-02-28",
  "order_by": "cost",
  "order_type": "desc",
  "dimension": 5,
  "income_type": 2,
  "column_list": ["cost","roi1","roi7","total_roi"],
  "project": ["2"],
  "device_os": 1
}
```

**示例 5**: "今天3D捕鱼头条信息流的分小时数据"

```json
{
  "date": "2026-03-02",
  "project_id": 2,
  "platform": 1,
  "sub_channel": 4
}
```

> 使用 `fetch-hourly.mjs`，注意参数类型与常规报表不同：`project_id` 是 number，`platform` 是 number。

**示例 6**: "看一下今天欢乐钓鱼大师安卓端按小时的消耗"

```json
{
  "date": "2026-03-02",
  "project_id": 9420,
  "device_os": 1
}
```

> 仅传必要筛选条件，未提及的参数不传。

## 分小时端点参数构造规则

### 日期 (date)

仅支持单日，格式 `YYYY-MM-DD`。用户说"今天"就用当天日期，说"昨天"用昨天。

### 筛选参数（可选）

与常规报表共用 filters.md 中的 ID 映射，但**参数类型不同**：

| 参数 | 类型 | 说明 | 对比常规报表 |
|------|------|------|-------------|
| project_id | number | 项目 ID | 常规为 `project: string[]` |
| platform | number | 平台 ID | 常规为 `platform: string[]` |
| sub_channel | number | 子渠道 ID | 常规为 `sub_channel: string` |
| device_os | number | 设备系统 | 相同 |
| studio_id | number | 工作室 ID | 常规为 `studio: string[]` |
| spread_type | string | 推广类型 | 相同 |
| account_id | string | 单个账户 ID | 常规为 `account_id_list: string[]` |

用户未提及的筛选条件**不传**。

## 歧义处理

- 用户提到本 API 不支持的指标 → 说明不支持并列出可用指标
- 日期表述不清 → 默认今天，并告知用户使用的日期范围
- 排序字段不在 column_list 中 → 自动加入 column_list
- 用户用名称描述筛选条件（如"腾讯渠道"）但无法确定 ID → 提示用户确认对应 ID
- 用户未提及筛选条件 → 不传筛选参数，查询全量数据

## 输出格式

1. 展示构造的请求参数（JSON）
2. 执行脚本获取数据
3. 以 markdown 表格展示结果，字段使用中文别名
4. 如果用户要求可视化展示（图表、趋势图等），将数据传递给数据可视化 Skill 处理
