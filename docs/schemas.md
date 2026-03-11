# Schemas

## 1. Account Group

```json
{
  "group_id": "grp_xxx",
  "group_name": "A组",
  "source_type": "manual | rule | hybrid",
  "manual_account_ids": [],
  "rule_expression": {},
  "resolved_account_ids": []
}
```

## 2. Report Query

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
  "metrics": ["cost", "show", "click", "ctr", "cvr", "new_user", "roi1"],
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

## 3. Report Result

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

## 4. Analysis Result

```json
{
  "summary": "",
  "key_diffs": [],
  "top_materials": [],
  "anomalies": [],
  "evidence_refs": []
}
```
