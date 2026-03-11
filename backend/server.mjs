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
      if (!process.env.AD_MANAGER_TOKEN) {
        sendJson(res, 500, {
          error: 'missing_token',
          message: 'AD_MANAGER_TOKEN 未设置，请先在启动 backend 前 export。',
        })
        return
      }

      const parsed = await parseRequestBody(req)
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
    return
  }

  sendJson(res, 404, { error: 'not_found' })
})

server.listen(8787, '0.0.0.0', () => {
  console.log('Backend listening on http://0.0.0.0:8787')
})
