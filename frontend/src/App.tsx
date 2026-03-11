import { useMemo, useState } from 'react'

type Group = {
  id: string
  name: string
  type: 'manual' | 'rule' | 'hybrid'
  accounts: number
  note: string
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

const groups: Group[] = [
  { id: 'grp-a', name: 'A组', type: 'rule', accounts: 18, note: '日本 / Meta / 项目A' },
  { id: 'grp-b', name: 'B组', type: 'hybrid', accounts: 22, note: '日本 / 广点通 / 项目A + 手工调整' },
]

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

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return String(value)
}

function App() {
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const columns = useMemo(() => report?.columns ?? fallbackColumns, [report])
  const rows = useMemo(() => report?.rows ?? fallbackRows, [report])

  async function loadRealData() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:8787/api/report/platform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: 'platform',
          body: {
            page: 1,
            page_size: 10,
            start_date: '2026-03-11',
            end_date: '2026-03-11',
            order_by: 'cost',
            order_type: 'desc',
            dimension: 5,
            income_type: 2,
            column_list: ['cost', 'click', 'ctr', 'new_user', 'roi1'],
          },
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.message || '查询失败')
      }

      setReport(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
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
        <div className="context-card"><span>时间范围</span><strong>2026-03-11</strong></div>
        <div className="context-card"><span>维度</span><strong>平台/渠道</strong></div>
        <div className="context-card"><span>指标</span><strong>消耗 / 点击 / CTR / 新增 / ROI1</strong></div>
      </section>

      <main className="workspace-grid">
        <aside className="panel sidebar-left">
          <div className="panel-header">
            <h2>对比组</h2>
            <button className="ghost small">新建组</button>
          </div>
          <div className="group-list">
            {groups.map((group) => (
              <div key={group.id} className="group-card">
                <div className="group-card-top">
                  <strong>{group.name}</strong>
                  <span className="badge">{group.type}</span>
                </div>
                <div className="muted">{group.note}</div>
                <div className="group-meta">{group.accounts} 个账户</div>
              </div>
            ))}
          </div>

          <div className="panel-section">
            <h3>常用分析</h3>
            <ul className="shortcut-list">
              <li>最近 7 天组间总览</li>
              <li>渠道表现差异</li>
              <li>素材维度 Top 表现</li>
              <li>高消耗低转化异常扫描</li>
            </ul>
          </div>
        </aside>

        <section className="panel center-panel">
          <div className="panel-header">
            <h2>AI 对话</h2>
            <span className="status">query-channel-report 已联调</span>
          </div>

          <div className="chat-thread">
            <div className="message user">
              比较 A组 和 B组 最近 7 天日本市场的渠道表现，重点看消耗、CTR、新增和 ROI1。
            </div>
            <div className="message assistant">
              现在前端已接入第一条真实查询链路。你可以点击“加载真实数据”验证 query-channel-report → ad-manager-api → 前端表格是否打通。
            </div>
          </div>

          <div className="plan-card">
            <h3>当前执行计划</h3>
            <ol>
              <li>解析 A/B 组到账户 ID</li>
              <li>调用 query-channel-report 查询渠道报表</li>
              <li>汇总组间指标差异</li>
              <li>生成结论摘要</li>
            </ol>
          </div>

          <div className="composer actions-row">
            <input value="帮我继续下钻，看下素材维度 Top 20" readOnly />
            <button className="ghost" onClick={loadRealData} disabled={loading}>
              {loading ? '加载中...' : '加载真实数据'}
            </button>
            <button className="primary">发送</button>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}
        </section>

        <aside className="panel sidebar-right">
          <div className="panel-header">
            <h2>结果工作区</h2>
            <button className="ghost small">导出</button>
          </div>

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
    </div>
  )
}

export default App
