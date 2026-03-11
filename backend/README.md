# backend

当前是一个最小本地 API 桥接层，用于把前端请求接到已联调成功的 `ad-manager-api` 脚本上。

## 启动

```bash
export AD_MANAGER_TOKEN="你的 token"
node server.mjs
```

或：

```bash
npm run dev
```

## 当前接口

### 健康检查
`GET /api/health`

### 查询平台/渠道报表
`POST /api/report/platform`

请求体示例：

```json
{
  "endpoint": "platform",
  "body": {
    "page": 1,
    "page_size": 10,
    "start_date": "2026-03-11",
    "end_date": "2026-03-11",
    "order_by": "cost",
    "order_type": "desc",
    "dimension": 5,
    "income_type": 2,
    "column_list": ["cost", "click", "ctr", "new_user", "roi1"]
  }
}
```

## 说明

当前只做 MVP 级桥接，后续会演进为真正的 `query-channel-report` 服务层。
