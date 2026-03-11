#!/usr/bin/env node

/**
 * Ad Manager 分小时报表请求脚本
 *
 * 用法:
 *   node fetch-hourly.mjs --body '<json>'
 *   node fetch-hourly.mjs --body-file request.json
 *   node fetch-hourly.mjs --body '<json>' --raw
 *   node fetch-hourly.mjs --body '<json>' --endpoint custom_path
 *
 * 环境变量:
 *   AD_MANAGER_TOKEN - JWT 认证 token（必须）
 */

const BASE_URL =
  "https://pt09-tradedesk-online.tuyoo.com/api/ad-manager/platform/v1/hourly_data";
const DEFAULT_ENDPOINT = "data";

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
    }
  }
  return args;
}

async function loadBody(args) {
  if (args.body) return JSON.parse(args.body);
  if (args.bodyFile) {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(args.bodyFile, "utf-8");
    return JSON.parse(content);
  }
  throw new Error("必须提供 --body '<json>' 或 --body-file <path>");
}

function formatValue(val) {
  if (val === null || val === undefined) return "-";
  if (typeof val === "number") {
    if (Number.isInteger(val)) return val.toLocaleString();
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
  const separator = "| " + columns.map(() => "---").join(" | ") + " |";
  console.log(header);
  console.log(separator);
  for (const row of rows) {
    const line =
      "| " + columns.map((k) => formatValue(row[k])).join(" | ") + " |";
    console.log(line);
  }
}

function detectColumns(rows) {
  if (!rows || rows.length === 0) return [];
  const colSet = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) colSet.add(key);
  }
  const priority = ["date", "hour"];
  const sorted = [];
  for (const p of priority) {
    if (colSet.has(p)) {
      sorted.push(p);
      colSet.delete(p);
    }
  }
  return [...sorted, ...colSet];
}

const TOTAL_LABELS = {
  new_user_total: "新增设备",
  pay_user_total: "付费用户",
  pay1_total: "首日付费",
  account_total: "账户数",
  cost_total: "消耗",
  show_total: "展示",
  click_total: "点击",
  active_total: "激活",
  cost_per_new_user_total: "新增成本",
};

function printSummary(data) {
  const lines = [];
  for (const [key, label] of Object.entries(TOTAL_LABELS)) {
    if (data[key] !== undefined && data[key] !== null) {
      lines.push(`- **${label}**: ${formatValue(data[key])}`);
    }
  }
  if (data.latest_time) {
    lines.push(`- **数据更新时间**: ${data.latest_time}`);
  }
  if (lines.length > 0) {
    console.log("\n**汇总:**\n");
    for (const l of lines) console.log(l);
  }
}

async function main() {
  const args = parseArgs(process.argv);

  const token = args.token || process.env.AD_MANAGER_TOKEN;
  if (!token) {
    console.error(
      "错误: 未提供 token。请设置环境变量 AD_MANAGER_TOKEN 或使用 --token"
    );
    process.exit(1);
  }

  const body = await loadBody(args);
  const endpoint = args.endpoint || DEFAULT_ENDPOINT;
  const url = `${BASE_URL}/${endpoint}/`;

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

  if (list.length === 0) {
    console.log("(无数据)");
    return;
  }

  const columns = detectColumns(list);
  console.log(`\n共 ${list.length} 个小时数据:\n`);
  formatMarkdownTable(list, columns);
  printSummary(data);
}

main().catch((err) => {
  console.error(`执行失败: ${err.message}`);
  process.exit(1);
});
