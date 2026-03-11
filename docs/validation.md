# Validation

## query-channel-report / ad-manager-api 联调记录

### 时间
2026-03-11

### 验证目标
确认第一个底层查询 skill 是否能够通过真实 token 调用线上广告管理报表 API。

### 使用脚本
- `skills/query-channel-report/ad-manager-api/scripts/fetch-report.mjs`

### 请求参数
```json
{
  "page": 1,
  "page_size": 5,
  "start_date": "2026-03-11",
  "end_date": "2026-03-11",
  "order_by": "cost",
  "order_type": "desc",
  "dimension": 5,
  "income_type": 2,
  "column_list": ["cost", "click", "ctr", "new_user", "roi1"]
}
```

### 结果
- 成功返回数据
- 成功输出 markdown 表格
- 成功输出汇总结果
- token 可用
- API 通路正常

### 当前结论
`ad-manager-api` 已具备 MVP 阶段的真实可用性，可作为 `query-channel-report` 的底层 provider。

### 待确认事项
- `dimension` 编码与返回字段口径是否完全一致
- 平台 / 渠道 / 子平台口径是否需要在工作台做统一命名
- 后续需要把原始返回包装为标准化结构，供前端直接消费

### 安全说明
- token 仅用于临时联调
- 不应写入仓库文件
- 建议后续统一通过本地环境变量管理
