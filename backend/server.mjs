import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const scriptPath = join(rootDir, 'skills', 'query-channel-report', 'ad-manager-api', 'scripts', 'fetch-report.mjs')
const dataDir = join(__dirname, 'data')
const groupsFilePath = join(dataDir, 'groups.json')

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
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

async function ensureGroupsFile() {
  await mkdir(dataDir, { recursive: true })
  try {
    await readFile(groupsFilePath, 'utf-8')
  } catch {
    await writeFile(groupsFilePath, '[]\n', 'utf-8')
  }
}

async function readGroups() {
  await ensureGroupsFile()
  const content = await readFile(groupsFilePath, 'utf-8')
  return JSON.parse(content)
}

async function writeGroups(groups) {
  await ensureGroupsFile()
  await writeFile(groupsFilePath, `${JSON.stringify(groups, null, 2)}\n`, 'utf-8')
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = ''
    req.on('data', (chunk) => {
      rawBody += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {})
      } catch (error) {
        reject(error)
      }
    })
  })
}

function createGroupId() {
  return `grp-${Date.now().toString(36)}`
}

function normalizeAdvertiserIds(input) {
  if (!input) return []
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean)
  }
  return String(input)
    .split(/[\n,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function defaultReportBody() {
  return {
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
}

async function runPlatformReport(parsed) {
  if (!process.env.AD_MANAGER_TOKEN) {
    throw new Error('AD_MANAGER_TOKEN 未设置，请先在启动 backend 前 export。')
  }

  const body = parsed.body || defaultReportBody()
  const endpoint = parsed.endpoint || 'platform'
  const result = await invokeReportScript({ endpoint, body })
  const data = result.data || {}
  const metrics = body.column_list || ['cost', 'click', 'ctr', 'new_user', 'roi1']

  return {
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
  }
}

function percentileThreshold(values, percentile) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentile)))
  return sorted[index]
}

function analyzeAdAnomalies(rows = []) {
  const cleanRows = rows.filter((row) => typeof row.cost === 'number')
  if (cleanRows.length === 0) return []

  const costP70 = percentileThreshold(cleanRows.map((row) => Number(row.cost || 0)), 0.7)
  const roiP30 = percentileThreshold(cleanRows.map((row) => Number(row.roi1 || 0)), 0.3)
  const newUserP30 = percentileThreshold(cleanRows.map((row) => Number(row.new_user || 0)), 0.3)
  const clickP70 = percentileThreshold(cleanRows.map((row) => Number(row.click || 0)), 0.7)
  const ctrP70 = percentileThreshold(cleanRows.map((row) => Number(row.ctr || 0)), 0.7)
  const roiP80 = percentileThreshold(cleanRows.map((row) => Number(row.roi1 || 0)), 0.8)
  const newUserP80 = percentileThreshold(cleanRows.map((row) => Number(row.new_user || 0)), 0.8)
  const costP50 = percentileThreshold(cleanRows.map((row) => Number(row.cost || 0)), 0.5)

  const anomalies = []

  for (const row of cleanRows) {
    const cost = Number(row.cost || 0)
    const click = Number(row.click || 0)
    const ctr = Number(row.ctr || 0)
    const newUser = Number(row.new_user || 0)
    const roi1 = Number(row.roi1 || 0)
    const adName = row.raw?.ad_name || row.dimensionLabel || '未知广告'
    const adId = row.raw?.ad_id || '-'

    if (cost >= costP70 && (roi1 <= roiP30 || newUser <= newUserP30)) {
      anomalies.push({
        adId,
        adName,
        anomalyType: 'high_cost_low_return',
        priority: 'P1',
        reason: '消耗处于组内前30%，但 ROI1 或新增落在组内后30%。',
        metrics: { cost, click, ctr, new_user: newUser, roi1 },
      })
      continue
    }

    if ((click >= clickP70 || ctr >= ctrP70) && newUser <= newUserP30) {
      anomalies.push({
        adId,
        adName,
        anomalyType: 'high_click_low_new_user',
        priority: 'P2',
        reason: '点击或 CTR 较高，但新增落在组内后30%。',
        metrics: { cost, click, ctr, new_user: newUser, roi1 },
      })
      continue
    }

    if (cost <= costP50 && (roi1 >= roiP80 || newUser >= newUserP80)) {
      anomalies.push({
        adId,
        adName,
        anomalyType: 'low_cost_high_potential',
        priority: 'P3',
        reason: '消耗较低，但 ROI1 或新增进入组内前20%。',
        metrics: { cost, click, ctr, new_user: newUser, roi1 },
      })
    }
  }

  const priorityOrder = { P1: 1, P2: 2, P3: 3 }
  return anomalies
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.metrics.cost - a.metrics.cost)
    .slice(0, 10)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    })
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'GET' && req.url === '/api/groups') {
    const groups = await readGroups()
    sendJson(res, 200, { groups })
    return
  }

  if (req.method === 'POST' && req.url === '/api/groups') {
    try {
      const body = await parseRequestBody(req)
      const groups = await readGroups()
      const now = new Date().toISOString()
      const group = {
        id: createGroupId(),
        name: String(body.name || '').trim() || '未命名分组',
        advertiserIds: normalizeAdvertiserIds(body.advertiserIds),
        note: String(body.note || '').trim(),
        createdAt: now,
        updatedAt: now,
      }
      groups.push(group)
      await writeGroups(groups)
      sendJson(res, 201, { group })
    } catch (error) {
      sendJson(res, 400, { error: 'invalid_body', message: error.message })
    }
    return
  }

  if (req.method === 'PUT' && req.url?.startsWith('/api/groups/')) {
    try {
      const groupId = req.url.split('/').pop()
      const body = await parseRequestBody(req)
      const groups = await readGroups()
      const index = groups.findIndex((group) => group.id === groupId)

      if (index === -1) {
        sendJson(res, 404, { error: 'group_not_found' })
        return
      }

      const existing = groups[index]
      const updated = {
        ...existing,
        name: String(body.name ?? existing.name).trim() || existing.name,
        advertiserIds: body.advertiserIds ? normalizeAdvertiserIds(body.advertiserIds) : existing.advertiserIds,
        note: body.note !== undefined ? String(body.note).trim() : existing.note,
        updatedAt: new Date().toISOString(),
      }

      groups[index] = updated
      await writeGroups(groups)
      sendJson(res, 200, { group: updated })
    } catch (error) {
      sendJson(res, 400, { error: 'invalid_body', message: error.message })
    }
    return
  }

  if (req.method === 'DELETE' && req.url?.startsWith('/api/groups/')) {
    const groupId = req.url.split('/').pop()
    const groups = await readGroups()
    const nextGroups = groups.filter((group) => group.id !== groupId)
    await writeGroups(nextGroups)
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'POST' && req.url === '/api/report/platform') {
    try {
      const parsed = await parseRequestBody(req)
      const result = await runPlatformReport(parsed)
      sendJson(res, 200, result)
    } catch (error) {
      sendJson(res, 500, {
        error: 'query_failed',
        message: error.message,
      })
    }
    return
  }

  if (req.method === 'POST' && req.url === '/api/report/grouped') {
    try {
      const parsed = await parseRequestBody(req)
      const groups = await readGroups()
      const groupIds = Array.isArray(parsed.groupIds) ? parsed.groupIds : []
      const targetGroups = groups.filter((group) => groupIds.includes(group.id))
      const baseBody = parsed.body || defaultReportBody()

      const results = []
      for (const group of targetGroups) {
        const report = await runPlatformReport({
          endpoint: parsed.endpoint || 'platform',
          body: {
            ...baseBody,
            account_id_list: group.advertiserIds,
          },
        })

        results.push({
          group: {
            id: group.id,
            name: group.name,
            advertiserIds: group.advertiserIds,
          },
          report,
          mappingNote: '当前版本将 advertiserIds 临时映射为 account_id_list 执行查询。',
        })
      }

      sendJson(res, 200, {
        grouped: results,
        queryMeta: {
          endpoint: parsed.endpoint || 'platform',
          baseBody,
        },
      })
    } catch (error) {
      sendJson(res, 500, {
        error: 'grouped_query_failed',
        message: error.message,
      })
    }
    return
  }

  if (req.method === 'POST' && req.url === '/api/analysis/ad-anomalies') {
    try {
      const parsed = await parseRequestBody(req)
      const groups = await readGroups()
      const groupIds = Array.isArray(parsed.groupIds) ? parsed.groupIds : []
      const targetGroups = groups.filter((group) => groupIds.includes(group.id))
      const baseBody = parsed.body || {
        ...defaultReportBody(),
        dimension: 10,
        page_size: 50,
        column_list: ['cost', 'click', 'ctr', 'new_user', 'roi1'],
      }

      const results = []
      for (const group of targetGroups) {
        const report = await runPlatformReport({
          endpoint: parsed.endpoint || 'platform',
          body: {
            ...baseBody,
            dimension: 10,
            account_id_list: group.advertiserIds,
          },
        })

        const anomalies = analyzeAdAnomalies(report.rows)
        results.push({
          group: {
            id: group.id,
            name: group.name,
            advertiserIds: group.advertiserIds,
          },
          anomalies,
          scannedAds: report.rows.length,
          mappingNote: '当前版本将 advertiserIds 临时映射为 account_id_list，并在广告维度（dimension=10）下进行异常扫描。',
        })
      }

      sendJson(res, 200, {
        grouped: results,
        queryMeta: {
          endpoint: parsed.endpoint || 'platform',
          baseBody,
          analysisMode: 'ad_anomalies_v1',
        },
      })
    } catch (error) {
      sendJson(res, 500, {
        error: 'ad_anomalies_failed',
        message: error.message,
      })
    }
    return
  }

  sendJson(res, 404, { error: 'not_found' })
})

server.listen(8787, '0.0.0.0', () => {
  console.log('Backend listening on http://0.0.0.0:8787')
})
