import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const scriptPath = join(rootDir, 'skills', 'query-channel-report', 'ad-manager-api', 'scripts', 'fetch-report.mjs')

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(payload))
}

function normalizeRows(list = [], metrics = []) {
  return list.map((row) => ({
    dimensionLabel:
      row.platform_name ||
      row.project_name ||
      row.account_name ||
      row.campaign_name ||
      row.ad_name ||
      row.day ||
      row.week ||
      row.month ||
      '-',
    ...Object.fromEntries(metrics.map((metric) => [metric, row[metric]])),
    raw: row,
  }))
}

function buildColumns(metrics = []) {
  const labels = {
    cost: '消耗',
    click: '点击',
    ctr: 'CTR',
    new_user: '新增',
    roi1: 'ROI1',
    show: '展示',
    cvr: 'CVR',
  }

  return [
    { key: 'dimensionLabel', label: '维度' },
    ...metrics.map((metric) => ({ key: metric, label: labels[metric] || metric })),
  ]
}

function invokeReportScript({ endpoint, body }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, '--endpoint', endpoint, '--body', JSON.stringify(body), '--raw'], {
      cwd: rootDir,
      env: process.env,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `script exited with code ${code}`))
        return
      }
      try {
        resolve(JSON.parse(stdout))
      } catch (error) {
        reject(new Error(`invalid JSON from report script: ${error.message}`))
      }
    })
  })
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    })
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'POST' && req.url === '/api/report/platform') {
    let rawBody = ''
    req.on('data', (chunk) => {
      rawBody += chunk.toString()
    })

    req.on('end', async () => {
      try {
        if (!process.env.AD_MANAGER_TOKEN) {
          sendJson(res, 500, {
            error: 'missing_token',
            message: 'AD_MANAGER_TOKEN 未设置，请先在启动 backend 前 export。',
          })
          return
        }

        const parsed = rawBody ? JSON.parse(rawBody) : {}
        const body = parsed.body || {
          page: 1,
          page_size: 10,
          start_date: '2026-03-11',
          end_date: '2026-03-11',
          order_by: 'cost',
          order_type: 'desc',
          dimension: 5,
          income_type: 2,
          column_list: ['cost', 'click', 'ctr', 'new_user', 'roi1'],
        }

        const endpoint = parsed.endpoint || 'platform'
        const result = await invokeReportScript({ endpoint, body })
        const data = result.data || {}
        const metrics = body.column_list || ['cost', 'click', 'ctr', 'new_user', 'roi1']

        sendJson(res, 200, {
          meta: {
            endpoint,
            body,
            total: data.total ?? 0,
            page: data.page ?? 1,
          },
          columns: buildColumns(metrics),
          rows: normalizeRows(data.data_list || [], metrics),
          totals: data.summary || {},
          raw: result,
        })
      } catch (error) {
        sendJson(res, 500, {
          error: 'query_failed',
          message: error.message,
        })
      }
    })
    return
  }

  sendJson(res, 404, { error: 'not_found' })
})

server.listen(8787, () => {
  console.log('Backend listening on http://localhost:8787')
})
