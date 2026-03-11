#!/usr/bin/env node

/**
 * Ad Manager Report API 通用请求脚本
 *
 * 用法:
 *   node fetch-report.mjs --endpoint platform --body '<json>'
 *   node fetch-report.mjs --endpoint platform --body-file request.json
 *   node fetch-report.mjs --endpoint platform --body '<json>' --raw
 *
 * 环境变量:
 *   AD_MANAGER_TOKEN - JWT 认证 token（必须）
 */

const BASE_URL =
  "https://pt09-tradedesk-online.tuyoo.com/api/ad-manager/report/v1";

const DIMENSION_FIELDS = [
  "platform_id",
  "platform_name",
  "project_id",
  "project_name",
  "optimizer_id",
  "optimizer_name",
  "account_id",
  "account_name",
  "campaign_id",
  "campaign_name",
  "ad_id",
  "ad_name",
  "studio_id",
  "studio_name",
  "day",
  "month",
  "week",
];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--endpoint" && argv[i + 1]) {
      args.endpoint = argv[++i];
    } else if (key === "--body" && argv[i + 1]) {
      args.body = argv[++i];
    } else if (key === "--body-file" && argv[i + 1]) {
      args.bodyFile = argv[++i];
    } else if (key === "--token" && argv[i + 1]) {
      args.token = argv[++i];
    } else if (key === "--raw") {
      args.raw = true;
    } else if (key === "--no-summary") {
      args.noSummary = true;
    }
  }
  return args;
}

async function loadBody(args) {
  if (args.body) {
    return JSON.parse(args.body);
  }
  if (args.bodyFile) {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(args.bodyFile, "utf-8");
    return JSON.parse(content);
  }
  throw new Error("必须提供 --body '<json>' 或 --body-file <path>");
}

function pickDisplayColumns(row, requestedColumns) {
  const dimCols = DIMENSION_FIELDS.filter(
    (f) => row[f] !== undefined && row[f] !== "" && row[f] !== 0
  );
  const metricCols = requestedColumns || [];
  return [...dimCols, ...metricCols];
}

function formatValue(val) {
  if (val === null || val === undefined) return "-";
  if (typeof val === "number") {
    if (Number.isInteger(val)) return val.toLocaleString();
    if (Math.abs(val) < 1) return (val * 100).toFixed(2) + "%";
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(val);
}

function formatMarkdownTable(rows, columns) {
  if (!rows || rows.length === 0) {
    console.log("(无数据)");
    return;
  }

  const header = "| " + columns.join(" | ") + " |";
  const separator =
    "| " + columns.map(() => "---").join(" | ") + " |";

  console.log(header);
  console.log(separator);
  for (const row of rows) {
    const line =
      "| " + columns.map((k) => formatValue(row[k])).join(" | ") + " |";
    console.log(line);
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.endpoint) {
    console.error("错误: 必须指定 --endpoint <name>");
    process.exit(1);
  }

  const token = args.token || process.env.AD_MANAGER_TOKEN;
  if (!token) {
    console.error(
      "错误: 未提供 token。请设置环境变量 AD_MANAGER_TOKEN 或使用 --token"
    );
    process.exit(1);
  }

  const body = await loadBody(args);
  const url = `${BASE_URL}/${args.endpoint}/`;

  console.error(`→ POST ${url}`);
  console.error(`→ body: ${JSON.stringify(body, null, 2)}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`HTTP ${response.status}: ${text}`);
    process.exit(1);
  }

  const json = await response.json();

  if (args.raw) {
    console.log(JSON.stringify(json, null, 2));
    return;
  }

  if (json.code !== 0) {
    console.error(
      `API 错误 [code=${json.code}]: ${json.detail || json.message || ""}`
    );
    console.log(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  const { data } = json;
  const list = data.data_list || [];
  const total = data.total ?? list.length;
  const summary = data.summary;

  if (list.length === 0) {
    console.log("(无数据)");
    return;
  }

  const columns = pickDisplayColumns(list[0], body.column_list);

  console.log(`\n共 ${total} 条，当前第 ${data.page} 页，展示 ${list.length} 条:\n`);
  formatMarkdownTable(list, columns);

  if (summary && !args.noSummary) {
    console.log("\n**汇总:**\n");
    formatMarkdownTable([summary], columns);
  }
}

main().catch((err) => {
  console.error(`执行失败: ${err.message}`);
  process.exit(1);
});
