# Integration

## 目标

说明 `giga-trace-desk-ai` 项目中，业务层 skill、底层 ad-manager-api、账户组能力、前端工作台之间的关系。

---

## 一、分层结构

### 1. 前端工作台
负责：
- 对话输入
- 查询条件编辑
- 结果表格/图表展示
- 分析报告展示

### 2. AI 编排层
负责：
- 意图识别
- 参数补全
- skill 选择
- 调用顺序编排
- 多轮追问

### 3. 业务层 Skills
第一版包括：
- `query-channel-report`
- 后续可扩展：`compare-group-performance`、`analyze-material-performance`、`generate-analysis-report`

### 4. 底层 Provider
- `ad-manager-api`

负责：
- 字段映射
- 请求参数组装
- API 调用
- 原始数据返回

### 5. 数据与规则来源
- 广告管理报表 API
- 账户属性表
- 账户组定义（未来独立为 group service）

---

## 二、当前接入关系

### 已有
`query-channel-report/ad-manager-api/`

其内容包括：
- `SKILL.md`
- `references/endpoints.md`
- `references/columns.md`
- `references/filters.md`
- `scripts/fetch-report.mjs`
- `scripts/fetch-hourly.mjs`

### 新增
`query-channel-report/skill.md`

作为项目级 skill 定义，用来承接：
- AI 工作台输入
- 统一 schema
- 前端可消费输出

---

## 三、推荐调用链路

### 场景：用户查询渠道报表

用户输入：
> 比较 A 组和 B 组最近 7 天的渠道表现

调用流程：

1. 前端采集自然语言与当前上下文
2. AI 编排层生成 `query-channel-report` 输入 schema
3. 若包含组定义，则先 resolve 为 `account_ids`
4. `query-channel-report` 将统一 schema 映射为 `ad-manager-api` 请求体
5. `ad-manager-api` 脚本调用实际报表 API
6. 返回原始结果
7. `query-channel-report` 标准化结果结构
8. 前端展示表格/图表，分析模块继续消费

---

## 四、组查询接入建议

由于赛马分析的核心对象是“账户组”，建议在后续新增 group service 或 group registry。

### group service 职责
- 维护组定义
- 支持手工账户列表
- 支持基于属性规则的组
- 输出 resolved account ids
- 保存组版本

### 在第一版中的简化策略
第一版可先不单独做服务，使用 mock 或前端上下文传入：

```json
{
  "groups": [
    {
      "group_id": "grp_a",
      "group_name": "A组",
      "account_ids": ["1001", "1002"]
    }
  ]
}
```

然后由 `query-channel-report` 转成底层：

```json
{
  "account_id_list": ["1001", "1002"]
}
```

---

## 五、标准化输出的重要性

工作台前端和分析模块都不应该直接消费底层 API 原始返回。

原因：
- 原始字段口径可能变化
- 不利于前端统一表格与图表渲染
- 不利于后续新增多数据源
- 不利于报告和分析模块复用

因此统一通过 `query-channel-report` 输出：
- `meta`
- `columns`
- `rows`
- `totals`
- `group_summaries`
- `warnings`

---

## 六、后续建议新增的 Skills

### 1. compare-group-performance
输入：多个 group 的标准化报表结果
输出：组间差异、核心指标对比、贡献维度

### 2. analyze-material-performance
输入：素材维度查询结果
输出：高表现素材、低表现素材、异常素材、结构差异

### 3. generate-analysis-report
输入：查询结果 + 分析结果
输出：简版摘要 / 详细报告 / 管理层版本

---

## 七、MVP 实现顺序建议

### Step 1
完成 `query-channel-report` 统一输入输出定义

### Step 2
验证 `ad-manager-api` 能否稳定返回数据

### Step 3
定义一份 mock 标准化输出，供前端先开发

### Step 4
完成前端主工作台骨架

### Step 5
再补 group service 与对比分析 skill

---

## 八、当前结论

目前最合适的项目结构是：

- 保留 `ad-manager-api` 作为底层 provider
- 将 `query-channel-report` 作为业务层统一 skill
- 以后所有分析能力都优先消费标准化报表输出

这能保证：
- API 细节不泄漏到整个项目各处
- 前端与分析模块解耦
- 后续新增素材分析、差异分析更顺畅
