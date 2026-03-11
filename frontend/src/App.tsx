import { useEffect, useMemo, useRef, useState } from 'react'

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

type AdAnomaly = {
  adId: string
  adName: string
  anomalyType: string
  priority: 'P1' | 'P2' | 'P3'
  reason: string
  metrics: {
    cost: number
    click: number
    ctr: number
    new_user: number
    roi1: number
  }
}

type GroupedAnomalyItem = {
  group: {
    id: string
    name: string
    advertiserIds: string[]
  }
  anomalies: AdAnomaly[]
  scannedAds: number
  mappingNote?: string
}

type QueryIntent = {
  matchedGroups: Group[]
  dateRangeLabel: string
  startDate: string
  endDate: string
  metrics: string[]
  metricLabels: string[]
  dimensionLabel: string
  orderBy: string
  analysisMode: 'report' | 'ad-anomalies'
  hasExplicitDate: boolean
}

type MetricDef = {
  key: string
  label: string
  aliases: string[]
}

type LayoutWidths = {
  left: number
  center: number
  right: number
}

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last14' | 'custom'

const insights: Insight[] = [
  { title: 'A组 ROI1 更高', detail: 'A组近 7 天 ROI1 高于 B组，优势主要来自 Meta-日本流量。' },
  { title: 'B组素材结构分散', detail: 'B组头部素材贡献不足，长尾素材消耗更高，CPA 被拖累。' },
  { title: '可继续下钻素材维度', detail: '建议查看 CTR 前 20 素材与高消耗低转化素材。' },
]

const metricRegistry: MetricDef[] = [
  { key: 'cost', label: '消耗', aliases: ['消耗', '花费', '花费金额', 'cost'] },
  { key: 'show', label: '展示', aliases: ['展示', '曝光', 'impression', 'show'] },
  { key: 'click', label: '点击', aliases: ['点击', 'click'] },
  { key: 'ctr', label: 'CTR', aliases: ['ctr', '点击率', '点击率ctr'] },
  { key: 'cvr', label: 'CVR', aliases: ['cvr', '转化率'] },
  { key: 'convert', label: '转化', aliases: ['转化', 'convert'] },
  { key: 'active', label: '激活', aliases: ['激活', 'active'] },
  { key: 'convert_cost', label: '转化成本', aliases: ['转化成本', 'convert cost'] },
  { key: 'active_cost', label: '激活成本', aliases: ['激活成本', 'active cost'] },
  { key: 'cost_by_thousand_show', label: '千次展示成本', aliases: ['cpm', '千展', '千次展示成本'] },
  { key: 'new_user', label: '新增', aliases: ['新增', '新增用户', '新用户', '新增设备', 'new user'] },
  { key: 'new_paid_user', label: '新增付费用户', aliases: ['新增付费', '新增付费用户', '新付费用户'] },
  { key: 'new_paid_rate', label: '新增付费率', aliases: ['新增付费率', '付费率'] },
  { key: 'new_user_cost', label: '新增成本', aliases: ['新增成本', '单新增成本', 'new user cost'] },
  { key: 'new_paid_user_cost', label: '新增付费成本', aliases: ['新增付费成本', '新付费成本', 'new paid user cost'] },
  { key: 'new_user_ad_trace', label: '再归因新增', aliases: ['再归因新增', '归因新增'] },
  { key: 'advertiser_dau', label: 'DAU', aliases: ['dau', '日活', '日活跃用户'] },
  { key: 'advertiser_paid_dau', label: '付费DAU', aliases: ['付费dau', '内购付费人数'] },
  { key: 'pay1', label: '首日付费', aliases: ['首日付费', 'day1付费', 'pay1'] },
  { key: 'pay3', label: '3日付费', aliases: ['3日付费', 'pay3'] },
  { key: 'pay7', label: '7日付费', aliases: ['7日付费', 'pay7'] },
  { key: 'pay30', label: '30日付费', aliases: ['30日付费', 'pay30'] },
  { key: 'total_pay', label: '累计付费', aliases: ['累计付费', '总付费', 'total pay'] },
  { key: 'arppu_1', label: '首日ARPPU', aliases: ['arppu', '首日arppu'] },
  { key: 'advertiser_recharge', label: '内购流水', aliases: ['内购流水', '充值流水'] },
  { key: 'income', label: '广告收入', aliases: ['广告收入', '收入', 'income'] },
  { key: 'ltv1', label: '首日LTV', aliases: ['首日ltv', 'ltv1'] },
  { key: 'ltv7', label: '7日LTV', aliases: ['7日ltv', 'ltv7'] },
  { key: 'total_ltv', label: '累计LTV', aliases: ['累计ltv', '总ltv', 'total ltv'] },
  { key: 'roi1', label: '首日ROI', aliases: ['首日roi', 'roi1', 'roi'] },
  { key: 'roi3', label: '3日ROI', aliases: ['3日roi', 'roi3'] },
  { key: 'roi7', label: '7日ROI', aliases: ['7日roi', 'roi7'] },
  { key: 'roi30', label: '30日ROI', aliases: ['30日roi', 'roi30'] },
  { key: 'total_roi', label: '累计ROI', aliases: ['累计roi', '总roi', '累计回报率', '总回报率', 'total roi'] },
  { key: 'stay2', label: '次留', aliases: ['次留', '2日留存', 'stay2'] },
  { key: 'stay7', label: '7日留存', aliases: ['7日留存', 'stay7'] },
  { key: 'stay30', label: '30日留存', aliases: ['30日留存', 'stay30'] },
  { key: 'stay_num2', label: '次留人数', aliases: ['次留人数', '2日留存人数'] },
  { key: 'pay2_stay_rate', label: '2日付费留存率', aliases: ['2日付费留存', 'pay2留存'] },
  { key: 'pay7_stay_rate', label: '7日付费留存率', aliases: ['7日付费留存', 'pay7留存'] },
  { key: 'times3', label: '3日活跃天数', aliases: ['3日活跃天数', 'times3'] },
  { key: 'times7', label: '7日活跃天数', aliases: ['7日活跃天数', 'times7'] },
]

const fallbackColumns: ReportColumn[] = [
  { key: 'dimensionLabel', label: '维度' },
  { key: 'cost', label: '消耗' },
  { key: 'ctr', label: 'CTR' },
  { key: 'new_user', label: '新增' },
  { key: 'roi1', label: '首日ROI' },
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

const defaultLayout: LayoutWidths = {
  left: 280,
  center: 560,
  right: 420,
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
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

function anomalyTypeLabel(type: string) {
  switch (type) {
    case 'high_cost_low_return':
      return '高消耗低回报'
    case 'high_click_low_new_user':
      return '高点击低新增'
    case 'low_cost_high_potential':
      return '低消耗高潜力'
    default:
      return type
  }
}

function inferMetrics(text: string) {
  const lower = text.toLowerCase()
  const matches = metricRegistry.filter((metric) =>
    metric.aliases.some((alias) => lower.includes(alias.toLowerCase())),
  )

  const uniqueMatches = Array.from(new Map(matches.map((metric) => [metric.key, metric])).values())
  const finalMatches = uniqueMatches.length > 0
    ? uniqueMatches
    : metricRegistry.filter((metric) => ['cost', 'click', 'ctr', 'new_user', 'roi1'].includes(metric.key))

  return {
    metricKeys: finalMatches.map((metric) => metric.key),
    metricLabels: finalMatches.map((metric) => metric.label),
  }
}

function inferIntent(text: string, groups: Group[]): QueryIntent {
  const today = new Date()
  const lower = text.toLowerCase()

  let startDate = formatDate(today)
  let endDate = formatDate(today)
  let dateRangeLabel = '今天'
  let hasExplicitDate = false

  if (text.includes('最近7天') || text.includes('近7天') || lower.includes('last 7')) {
    startDate = formatDate(addDays(today, -6))
    endDate = formatDate(today)
    dateRangeLabel = '最近 7 天'
    hasExplicitDate = true
  } else if (text.includes('最近14天') || text.includes('近14天') || lower.includes('last 14')) {
    startDate = formatDate(addDays(today, -13))
    endDate = formatDate(today)
    dateRangeLabel = '最近 14 天'
    hasExplicitDate = true
  } else if (text.includes('昨天')) {
    startDate = formatDate(addDays(today, -1))
    endDate = formatDate(addDays(today, -1))
    dateRangeLabel = '昨天'
    hasExplicitDate = true
  }

  const { metricKeys, metricLabels } = inferMetrics(text)
  const matchedGroups = groups.filter((group) => text.includes(group.name))

  let dimensionLabel = '平台/渠道'
  let analysisMode: 'report' | 'ad-anomalies' = 'report'
  if (text.includes('广告') && (text.includes('异常') || text.includes('高消耗') || text.includes('低新增'))) {
    dimensionLabel = '广告异常扫描'
    analysisMode = 'ad-anomalies'
  } else if (text.includes('素材')) {
    dimensionLabel = '素材（待接入）'
  } else if (text.includes('广告')) {
    dimensionLabel = '广告维度'
  }

  const orderBy = metricKeys.includes('cost') ? 'cost' : metricKeys[0]

  return {
    matchedGroups,
    dateRangeLabel,
    startDate,
    endDate,
    metrics: metricKeys,
    metricLabels,
    dimensionLabel,
    orderBy,
    analysisMode,
    hasExplicitDate,
  }
}

function getPresetDates(preset: DatePreset) {
  const today = new Date()
  if (preset === 'today') {
    return { startDate: formatDate(today), endDate: formatDate(today), label: '今天' }
  }
  if (preset === 'yesterday') {
    const yesterday = addDays(today, -1)
    return { startDate: formatDate(yesterday), endDate: formatDate(yesterday), label: '昨天' }
  }
  if (preset === 'last7') {
    return { startDate: formatDate(addDays(today, -6)), endDate: formatDate(today), label: '最近 7 天' }
  }
  if (preset === 'last14') {
    return { startDate: formatDate(addDays(today, -13)), endDate: formatDate(today), label: '最近 14 天' }
  }
  return { startDate: formatDate(today), endDate: formatDate(today), label: '自定义' }
}

function loadSavedLayout(): LayoutWidths {
  try {
    const raw = localStorage.getItem('gtdai-layout-widths')
    if (!raw) return defaultLayout
    const parsed = JSON.parse(raw) as Partial<LayoutWidths>
    return {
      left: parsed.left ?? defaultLayout.left,
      center: parsed.center ?? defaultLayout.center,
      right: parsed.right ?? defaultLayout.right,
    }
  } catch {
    return defaultLayout
  }
}

function App() {
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [groupedReports, setGroupedReports] = useState<GroupedReportItem[]>([])
  const [groupedAnomalies, setGroupedAnomalies] = useState<GroupedAnomalyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('对比 A组、B组、C组 的数据，主要关注消耗、新增成本、新增付费成本、首日ROI、累计ROI。')
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupForm, setGroupForm] = useState(emptyGroupForm)
  const [lastIntent, setLastIntent] = useState<QueryIntent | null>(null)
  const [layout, setLayout] = useState<LayoutWidths>(() => loadSavedLayout())
  const [datePreset, setDatePreset] = useState<DatePreset>('last7')
  const [dateRange, setDateRange] = useState(() => getPresetDates('last7'))
  const workspaceRef = useRef<HTMLElement | null>(null)

  const columns = useMemo(() => report?.columns ?? fallbackColumns, [report])
  const rows = useMemo(() => report?.rows ?? fallbackRows, [report])
  const backendBaseUrl = useMemo(() => getBackendBaseUrl(), [])

  useEffect(() => {
    void loadGroups()
  }, [])

  useEffect(() => {
    localStorage.setItem('gtdai-layout-widths', JSON.stringify(layout))
  }, [layout])

  function startResize(handle: 'left' | 'right', event: React.PointerEvent<HTMLDivElement>) {
    if (window.innerWidth <= 1280) return
    const startX = event.clientX
    const startLayout = { ...layout }
    const minLeft = 220
    const minCenter = 420
    const minRight = 320

    const move = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX
      setLayout(() => {
        if (handle === 'left') {
          const nextLeft = Math.max(minLeft, startLayout.left + delta)
          const nextCenter = Math.max(minCenter, startLayout.center - (nextLeft - startLayout.left))
          return {
            left: nextLeft,
            center: nextCenter,
            right: startLayout.right,
          }
        }

        const nextCenter = Math.max(minCenter, startLayout.center + delta)
        const nextRight = Math.max(minRight, startLayout.right - (nextCenter - startLayout.center))
        return {
          left: startLayout.left,
          center: nextCenter,
          right: nextRight,
        }
      })
    }

    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

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

  function applyDatePreset(preset: DatePreset) {
    setDatePreset(preset)
    setDateRange(getPresetDates(preset))
  }

  async function queryReport(intent?: QueryIntent) {
    const inferredIntent = intent ?? inferIntent(draft, groups)
    const currentIntent = inferredIntent.hasExplicitDate
      ? inferredIntent
      : {
          ...inferredIntent,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          dateRangeLabel: dateRange.label,
        }
    setLastIntent(currentIntent)
    setLoading(true)
    setError(null)

    try {
      if (currentIntent.analysisMode === 'ad-anomalies' && currentIntent.matchedGroups.length > 0) {
        const response = await fetch(`${backendBaseUrl}/api/analysis/ad-anomalies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: 'platform',
            groupIds: currentIntent.matchedGroups.map((group) => group.id),
            body: {
              page: 1,
              page_size: 50,
              start_date: currentIntent.startDate,
              end_date: currentIntent.endDate,
              order_by: currentIntent.orderBy,
              order_type: 'desc',
              dimension: 10,
              income_type: 2,
              column_list: currentIntent.metrics,
            },
          }),
        })

        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.message || '广告异常扫描失败')
        }

        setGroupedAnomalies(json.grouped ?? [])
        setGroupedReports([])
        setReport(null)
        return
      }

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
        setGroupedAnomalies([])
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
      setGroupedAnomalies([])
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
        <div className="context-card"><span>日期范围</span><strong>{lastIntent?.dateRangeLabel ?? dateRange.label}</strong></div>
        <div className="context-card"><span>维度</span><strong>{lastIntent?.dimensionLabel ?? '平台/渠道'}</strong></div>
        <div className="context-card"><span>指标</span><strong>{(lastIntent?.metricLabels ?? ['消耗', '点击', 'CTR', '新增', '首日ROI']).join(' / ')}</strong></div>
      </section>

      <main
        ref={workspaceRef}
        className="workspace-grid resizable-grid"
        style={{
          gridTemplateColumns: `${layout.left}px 8px minmax(420px, ${layout.center}px) 8px minmax(${layout.right}px, 1fr)`,
        }}
      >
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
              <li>对比 A组、B组、C组 的数据，主要关注消耗、新增成本、新增付费成本、首日ROI、累计ROI</li>
              <li>观察 A组 和 B组 最近7天 广告是否有异常</li>
              <li>查询 A组 今天渠道表现</li>
              <li>查询 B组 最近7天 渠道表现</li>
            </ul>
          </div>
        </aside>

        <div className="resize-handle" onPointerDown={(event) => startResize('left', event)} />

        <section className="panel center-panel">
          <div className="panel-header">
            <h2>AI 对话</h2>
            <span className="status">全量指标词典已接入</span>
          </div>

          <div className="chat-thread">
            <div className="message user">{draft}</div>
            <div className="message assistant">
              现在不再只限于少量写死指标，而是接入了一版更完整的指标词典。像新增成本、新增付费成本、首日ROI、累计ROI、首日付费、付费率、留存等关键词都能识别。
            </div>
          </div>

          {lastIntent ? (
            <div className="intent-card">
              <h3>本次解析结果</h3>
              <div className="intent-grid">
                <div><span>命中分组</span><strong>{lastIntent.matchedGroups.map((group) => group.name).join('、') || '未命中，默认全量'}</strong></div>
                <div><span>时间范围</span><strong>{lastIntent.dateRangeLabel}</strong></div>
                <div><span>查询维度</span><strong>{lastIntent.dimensionLabel}</strong></div>
                <div><span>模式</span><strong>{lastIntent.analysisMode === 'ad-anomalies' ? '广告异常扫描' : '报表查询'}</strong></div>
                <div className="full-span"><span>识别指标</span><strong>{lastIntent.metricLabels.join('、')}</strong></div>
              </div>
            </div>
          ) : null}

          <div className="date-filter-bar">
            <div className="date-presets">
              <button className={`ghost small ${datePreset === 'today' ? 'active-chip' : ''}`} onClick={() => applyDatePreset('today')}>今天</button>
              <button className={`ghost small ${datePreset === 'yesterday' ? 'active-chip' : ''}`} onClick={() => applyDatePreset('yesterday')}>昨天</button>
              <button className={`ghost small ${datePreset === 'last7' ? 'active-chip' : ''}`} onClick={() => applyDatePreset('last7')}>最近7天</button>
              <button className={`ghost small ${datePreset === 'last14' ? 'active-chip' : ''}`} onClick={() => applyDatePreset('last14')}>最近14天</button>
            </div>
            <div className="date-inputs">
              <label>
                <span>开始</span>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(event) => {
                    setDatePreset('custom')
                    setDateRange((current) => ({ ...current, startDate: event.target.value, label: '自定义' }))
                  }}
                />
              </label>
              <label>
                <span>结束</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(event) => {
                    setDatePreset('custom')
                    setDateRange((current) => ({ ...current, endDate: event.target.value, label: '自定义' }))
                  }}
                />
              </label>
            </div>
          </div>

          <div className="plan-card">
            <h3>当前执行计划</h3>
            <ol>
              <li>识别输入中的组名、时间范围、指标和分析模式</li>
              <li>从统一指标词典中匹配字段</li>
              <li>拼装真实查询参数</li>
              <li>展示查询或广告异常扫描结果</li>
            </ol>
          </div>

          <div className="composer composer-large">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="例如：对比 A组、B组、C组 的数据，主要关注消耗、新增成本、新增付费成本、首日ROI、累计ROI。"
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

        <div className="resize-handle" onPointerDown={(event) => startResize('right', event)} />

        <aside className="panel sidebar-right">
          <div className="panel-header">
            <h2>结果工作区</h2>
            <button className="ghost small">导出</button>
          </div>

          {groupedAnomalies.length > 0 ? (
            <div className="grouped-results">
              {groupedAnomalies.map((item) => (
                <div className="group-result-card" key={item.group.id}>
                  <div className="group-result-header">
                    <div>
                      <h3>{item.group.name}</h3>
                      <div className="muted">扫描广告数：{item.scannedAds}</div>
                    </div>
                  </div>

                  {item.mappingNote ? <div className="mapping-note">{item.mappingNote}</div> : null}

                  <div className="anomaly-list">
                    {item.anomalies.length === 0 ? <div className="muted">未识别到明显异常广告。</div> : null}
                    {item.anomalies.map((anomaly) => (
                      <div className="anomaly-card" key={`${item.group.id}-${anomaly.adId}-${anomaly.anomalyType}`}>
                        <div className="anomaly-head">
                          <strong>{anomaly.adName}</strong>
                          <span className={`priority ${anomaly.priority.toLowerCase()}`}>{anomaly.priority}</span>
                        </div>
                        <div className="anomaly-type">{anomalyTypeLabel(anomaly.anomalyType)}</div>
                        <div className="muted">{anomaly.reason}</div>
                        <div className="anomaly-metrics">
                          <span>消耗：{formatCell(anomaly.metrics.cost)}</span>
                          <span>点击：{formatCell(anomaly.metrics.click)}</span>
                          <span>CTR：{formatCell(anomaly.metrics.ctr)}</span>
                          <span>新增：{formatCell(anomaly.metrics.new_user)}</span>
                          <span>ROI1：{formatCell(anomaly.metrics.roi1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : groupedReports.length > 0 ? (
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
