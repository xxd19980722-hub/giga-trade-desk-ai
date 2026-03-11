import { useEffect, useMemo, useState } from 'react'

type Group = {
  id: string
  name: string
  advertiserIds: string[]
  note: string
  createdAt: string
  updatedAt: string
}

type Insight = {
  title: string
  detail: string
}

type ReportColumn = {
  key: string
  label: string
}

type ReportRow = {
  dimensionLabel: string
  [key: string]: unknown
}

type ReportResponse = {
  meta: {
    endpoint: string
    body: Record<string, unknown>
    total: number
    page: number
  }
  columns: ReportColumn[]
  rows: ReportRow[]
  totals: Record<string, unknown>
}

type GroupedReportItem = {
  group: {
    id: string
    name: string
    advertiserIds: string[]
  }
  report: ReportResponse
  mappingNote?: string
}

type QueryIntent = {
  matchedGroups: Group[]
  dateRangeLabel: string
  startDate: string
  endDate: string
  metrics: string[]
  dimensionLabel: string
  orderBy: string
}

const insights: Insight[] = [
  { title: 'A组 ROI1 更高', detail: 'A组近 7 天 ROI1 高于 B组，优势主要来自 Meta-日本流量。' },
  { title: 'B组素材结构分散', detail: 'B组头部素材贡献不足，长尾素材消耗更高，CPA 被拖累。' },
  { title: '可继续下钻素材维度', detail: '建议查看 CTR 前 20 素材与高消耗低转化素材。' },
]

const fallbackColumns: ReportColumn[] = [
  { key: 'dimensionLabel', label: '维度' },
  { key: 'cost', label: '消耗' },
  { key: 'ctr', label: 'CTR' },
  { key: 'new_user', label: '新增' },
  { key: 'roi1', label: 'ROI1' },
]

const fallbackRows: ReportRow[] = [
  { dimensionLabel: 'Meta', cost: '1,280,000', ctr: '2.83%', new_user: '12,430', roi1: '1.92' },
  { dimensionLabel: '广点通', cost: '980,000', ctr: '2.15%', new_user: '9,210', roi1: '1.36' },
  { dimensionLabel: '快手', cost: '420,000', ctr: '3.21%', new_user: '2,140', roi1: '1.08' },
]

const emptyGroupForm = {
  id: '',
  name: '',
  note: '',
  advertiserIdsText: '',
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return String(value)
}

function getBackendBaseUrl() {
  const host = window.location.hostname || 'localhost'
  return `http://${host}:8787`
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(base: Date, offset: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + offset)
  return next
}

function inferIntent(text: string, groups: Group[]): QueryIntent {
  const today = new Date()
  const lower = text.toLowerCase()

  let startDate = formatDate(today)
  let endDate = formatDate(today)
  let dateRangeLabel = '今天'

  if (text.includes('最近7天') || text.includes('近7天') || lower.includes('last 7')) {
    startDate = formatDate(addDays(today, -6))
    endDate = formatDate(today)
    dateRangeLabel = '最近 7 天'
  } else if (text.includes('最近14天') || text.includes('近14天') || lower.includes('last 14')) {
    startDate = formatDate(addDays(today, -13))
    endDate = formatDate(today)
    dateRangeLabel = '最近 14 天'
  } else if (text.includes('昨天')) {
    startDate = formatDate(addDays(today, -1))
    endDate = formatDate(addDays(today, -1))
    dateRangeLabel = '昨天'
  }

  const metricMap = [
    { keyword: '消耗', metric: 'cost' },
    { keyword: '点击', metric: 'click' },
    { keyword: 'ctr', metric: 'ctr' },
    { keyword: '新增', metric: 'new_user' },
    { keyword: 'roi1', metric: 'roi1' },
    { keyword: 'roi', metric: 'roi1' },
    { keyword: '展示', metric: 'show' },
  ]

  const metrics = Array.from(
    new Set(
      metricMap
        .filter((item) => lower.includes(item.keyword.toLowerCase()))
        .map((item) => item.metric),
    ),
  )

  const finalMetrics = metrics.length > 0 ? metrics : ['cost', 'click', 'ctr', 'new_user', 'roi1']

  const matchedGroups = groups.filter((group) => text.includes(group.name))

  let dimensionLabel = '平台/渠道'
  if (text.includes('素材')) {
    dimensionLabel = '素材（待接入）'
  } else if (text.includes('广告')) {
    dimensionLabel = '广告（待接入）'
  }

  const orderBy = finalMetrics.includes('cost') ? 'cost' : finalMetrics[0]

  return {
    matchedGroups,
    dateRangeLabel,
    startDate,
    endDate,
    metrics: finalMetrics,
    dimensionLabel,
    orderBy,
  }
}

function App() {
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [groupedReports, setGroupedReports] = useState<GroupedReportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('查询 A组 和 B组 最近7天 渠道表现，重点看消耗、点击、CTR、新增和 ROI1。')
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupForm, setGroupForm] = useState(emptyGroupForm)
  const [lastIntent, setLastIntent] = useState<QueryIntent | null>(null)

  const columns = useMemo(() => report?.columns ?? fallbackColumns, [report])
  const rows = useMemo(() => report?.rows ?? fallbackRows, [report])
  const backendBaseUrl = useMemo(() => getBackendBaseUrl(), [])

  useEffect(() => {
    void loadGroups()
  }, [])

  async function loadGroups() {
    setGroupsLoading(true)
    try {
      const response = await fetch(`${backendBaseUrl}/api/groups`)
      const json = await response.json()
      setGroups(json.groups ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载分组失败')
    } finally {
      setGroupsLoading(false)
    }
  }

  async function queryReport(intent?: QueryIntent) {
    const currentIntent = intent ?? inferIntent(draft, groups)
    setLastIntent(currentIntent)
    setLoading(true)
    setError(null)

    try {
      if (currentIntent.matchedGroups.length > 0) {
        const response = await fetch(`${backendBaseUrl}/api/report/grouped`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: 'platform',
            groupIds: currentIntent.matchedGroups.map((group) => group.id),
            body: {
              page: 1,
              page_size: 10,
              start_date: currentIntent.startDate,
              end_date: currentIntent.endDate,
              order_by: currentIntent.orderBy,
              order_type: 'desc',
              dimension: 5,
              income_type: 2,
              column_list: currentIntent.metrics,
            },
          }),
        })

        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.message || '分组查询失败')
        }

        const items = (json.grouped ?? []) as GroupedReportItem[]
        setGroupedReports(items)
        setReport(items[0]?.report ?? null)
        return
      }

      const response = await fetch(`${backendBaseUrl}/api/report/platform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: 'platform',
          body: {
            page: 1,
            page_size: 10,
            start_date: currentIntent.startDate,
            end_date: currentIntent.endDate,
            order_by: currentIntent.orderBy,
            order_type: 'desc',
            dimension: 5,
            income_type: 2,
            column_list: currentIntent.metrics,
          },
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.message || '查询失败')
      }

      setGroupedReports([])
      setReport(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  function handleSend() {
    const intent = inferIntent(draft, groups)
    void queryReport(intent)
  }

  function openCreateGroupModal() {
    setGroupForm(emptyGroupForm)
    setGroupModalOpen(true)
  }

  function openEditGroupModal(group: Group) {
    setGroupForm({
      id: group.id,
      name: group.name,
      note: group.note,
      advertiserIdsText: group.advertiserIds.join('\n'),
    })
    setGroupModalOpen(true)
  }

  async function saveGroup() {
    setError(null)

    const payload = {
      name: groupForm.name,
      note: groupForm.note,
      advertiserIds: groupForm.advertiserIdsText,
    }

    const isEditing = Boolean(groupForm.id)
    const url = isEditing ? `${backendBaseUrl}/api/groups/${groupForm.id}` : `${backendBaseUrl}/api/groups`
    const method = isEditing ? 'PUT' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.message || '保存分组失败')
      }

      await loadGroups()
      setGroupModalOpen(false)
      setGroupForm(emptyGroupForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存分组失败')
    }
  }

  async function deleteGroup(groupId: string) {
    setError(null)

    try {
      await fetch(`${backendBaseUrl}/api/groups/${groupId}`, {
        method: 'DELETE',
      })
      await loadGroups()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除分组失败')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">GIGA TRADE DESK AI</div>
          <h1>赛马分析工作台</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost">保存视图</button>
          <button className="primary">生成复盘摘要</button>
        </div>
      </header>

      <section className="context-strip">
        <div className="context-card"><span>项目</span><strong>项目A</strong></div>
        <div className="context-card"><span>时间范围</span><strong>{lastIntent?.dateRangeLabel ?? '今天'}</strong></div>
        <div className="context-card"><span>维度</span><strong>{lastIntent?.dimensionLabel ?? '平台/渠道'}</strong></div>
        <div className="context-card"><span>指标</span><strong>{(lastIntent?.metrics ?? ['cost', 'click', 'ctr', 'new_user', 'roi1']).join(' / ')}</strong></div>
      </section>

      <main className="workspace-grid">
        <aside className="panel sidebar-left">
          <div className="panel-header">
            <h2>对比组</h2>
            <button className="ghost small" onClick={openCreateGroupModal}>新建组</button>
          </div>
          <div className="group-list">
            {groupsLoading ? <div className="muted">正在加载分组...</div> : null}
            {groups.map((group) => (
              <div key={group.id} className="group-card">
                <div className="group-card-top">
                  <strong>{group.name}</strong>
                  <span className="badge">manual</span>
                </div>
                <div className="muted">{group.note || '无备注'}</div>
                <div className="group-meta">{group.advertiserIds.length} 个 advertiser_id</div>
                <div className="group-actions">
                  <button className="ghost small" onClick={() => openEditGroupModal(group)}>编辑</button>
                  <button className="ghost small danger" onClick={() => void deleteGroup(group.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>

          <div className="panel-section">
            <h3>常用分析</h3>
            <ul className="shortcut-list">
              <li>查询 A组 今天渠道表现</li>
              <li>查询 B组 最近7天 渠道表现</li>
              <li>查询 A组 最近14天 消耗、CTR、ROI1</li>
              <li>查询 A组 和 B组 最近7天 表现</li>
            </ul>
          </div>
        </aside>

        <section className="panel center-panel">
          <div className="panel-header">
            <h2>AI 对话</h2>
            <span className="status">分组多次查询已接入</span>
          </div>

          <div className="chat-thread">
            <div className="message user">{draft}</div>
            <div className="message assistant">
              现在如果命中了多个组，会按组分别发起查询，然后在右侧按组展示结果。当前版本采用 advertiserIds → account_id_list 的临时桥接方式。
            </div>
          </div>

          {lastIntent ? (
            <div className="intent-card">
              <h3>本次解析结果</h3>
              <div className="intent-grid">
                <div><span>命中分组</span><strong>{lastIntent.matchedGroups.map((group) => group.name).join('、') || '未命中，默认全量'}</strong></div>
                <div><span>时间范围</span><strong>{lastIntent.dateRangeLabel}</strong></div>
                <div><span>查询维度</span><strong>{lastIntent.dimensionLabel}</strong></div>
                <div><span>指标</span><strong>{lastIntent.metrics.join(', ')}</strong></div>
              </div>
            </div>
          ) : null}

          <div className="plan-card">
            <h3>当前执行计划</h3>
            <ol>
              <li>识别输入中的组名、时间范围、指标</li>
              <li>若命中多个组，则按组分别发起查询</li>
              <li>将每个组的结果独立展示</li>
              <li>后续再补真正的对比分析层</li>
            </ol>
          </div>

          <div className="composer composer-large">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="例如：查询 A组 和 B组 最近7天 渠道表现，重点看消耗、点击、CTR、新增和 ROI1。"
            />
            <div className="composer-toolbar">
              <div className="muted small-note">当前后端地址：{backendBaseUrl}</div>
              <div className="composer-actions">
                <button className="ghost" onClick={() => void queryReport()} disabled={loading}>
                  {loading ? '加载中...' : '加载真实数据'}
                </button>
                <button className="primary" onClick={handleSend} disabled={loading}>发送</button>
              </div>
            </div>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}
        </section>

        <aside className="panel sidebar-right">
          <div className="panel-header">
            <h2>结果工作区</h2>
            <button className="ghost small">导出</button>
          </div>

          {groupedReports.length > 0 ? (
            <div className="grouped-results">
              {groupedReports.map((item) => (
                <div className="group-result-card" key={item.group.id}>
                  <div className="group-result-header">
                    <div>
                      <h3>{item.group.name}</h3>
                      <div className="muted">{item.group.advertiserIds.length} 个 advertiser_id</div>
                    </div>
                  </div>

                  {item.mappingNote ? <div className="mapping-note">{item.mappingNote}</div> : null}

                  <div className="table-card">
                    <table>
                      <thead>
                        <tr>
                          {item.report.columns.map((column) => (
                            <th key={column.key}>{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {item.report.rows.map((row, index) => (
                          <tr key={`${item.group.id}-${row.dimensionLabel}-${index}`}>
                            {item.report.columns.map((column) => (
                              <td key={column.key}>{formatCell(row[column.key])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="tabs">
                <button className="tab active">表格</button>
                <button className="tab">图表</button>
                <button className="tab">差异</button>
                <button className="tab">报告</button>
              </div>

              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`${row.dimensionLabel}-${index}`}>
                        {columns.map((column) => (
                          <td key={column.key}>{formatCell(row[column.key])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {report ? (
            <div className="panel-section totals-card">
              <h3>本次真实查询</h3>
              <div className="muted">端点：{report.meta.endpoint}</div>
              <div className="muted">总条数：{report.meta.total}</div>
            </div>
          ) : null}

          <div className="panel-section">
            <h3>关键发现</h3>
            <div className="insight-list">
              {insights.map((insight) => (
                <div className="insight-card" key={insight.title}>
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {groupModalOpen ? (
        <div className="modal-backdrop" onClick={() => setGroupModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <h2>{groupForm.id ? '编辑对比组' : '新建对比组'}</h2>
              <button className="ghost small" onClick={() => setGroupModalOpen(false)}>关闭</button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>组名称</span>
                <input
                  value={groupForm.name}
                  onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="例如：A组 / 日本 Meta 测试组"
                />
              </label>

              <label className="field">
                <span>备注</span>
                <input
                  value={groupForm.note}
                  onChange={(event) => setGroupForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="可选备注"
                />
              </label>

              <label className="field full-width">
                <span>advertiser_id 列表</span>
                <textarea
                  value={groupForm.advertiserIdsText}
                  onChange={(event) => setGroupForm((current) => ({ ...current, advertiserIdsText: event.target.value }))}
                  placeholder="每行一个 advertiser_id，或用逗号分隔"
                />
              </label>
            </div>

            <div className="modal-actions">
              <button className="ghost" onClick={() => setGroupModalOpen(false)}>取消</button>
              <button className="primary" onClick={() => void saveGroup()}>保存分组</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
