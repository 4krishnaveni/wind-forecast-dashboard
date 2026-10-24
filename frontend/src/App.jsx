
import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API = 'http://127.0.0.1:8000'

function formatNumber(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('en-GB')
}

function formatDate(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function getHour(time) {
  return time?.slice(0, 13)
}

function buildComparison(actualRecords, forecastRecords) {
  // Average the two half-hourly actual readings to obtain an hourly value.
  const actualGroups = new Map()

  actualRecords.forEach((record) => {
    const hour = getHour(record.startTime)
    const generation = Number(record.generation)

    if (!hour || !Number.isFinite(generation)) return

    if (!actualGroups.has(hour)) actualGroups.set(hour, [])
    actualGroups.get(hour).push(generation)
  })

  const actualByHour = new Map(
    [...actualGroups.entries()].map(([hour, values]) => [
      hour,
      values.reduce((sum, value) => sum + value, 0) / values.length,
    ]),
  )

  // Keep one forecast per delivery hour.
  const forecastByHour = new Map()

  forecastRecords.forEach((record) => {
    const hour = getHour(record.startTime)
    const generation = Number(record.generation)

    if (hour && Number.isFinite(generation) && !forecastByHour.has(hour)) {
      forecastByHour.set(hour, {
        generation,
        publishTime: record.publishTime,
      })
    }
  })

  return [...actualByHour.entries()]
    .filter(([hour]) => forecastByHour.has(hour))
    .map(([hour, actual]) => ({
      hour,
      actual,
      forecast: forecastByHour.get(hour).generation,
      publishTime: forecastByHour.get(hour).publishTime,
      error: forecastByHour.get(hour).generation - actual,
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour))
}

function LineChart({ rows }) {
  const points = rows.slice(0, 48)

  if (!points.length) {
    return <div className="empty-chart">No matching data to chart yet.</div>
  }

  const width = 760
  const height = 280
  const padding = { top: 20, right: 20, bottom: 38, left: 62 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(
    1,
    ...points.map((point) => Math.max(point.actual, point.forecast)),
  )
  const scaleMax = Math.ceil(maxValue / 5000) * 5000 || maxValue

  const x = (index) =>
    padding.left +
    (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)

  const y = (value) =>
    padding.top + plotHeight - (value / scaleMax) * plotHeight

  const path = (key) =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point[key])}`)
      .join(' ')

  const ticks = [0, 1, 2, 3, 4].map((index) => (scaleMax / 4) * index)

  return (
    <div className="chart-scroll">
      <svg
        className="line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Hourly actual wind generation compared with forecast generation"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={y(tick)}
              x2={width - padding.right}
              y2={y(tick)}
              className="grid-line"
            />
            <text
              x={padding.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              className="axis-label"
            >
              {(tick / 1000).toFixed(0)}k
            </text>
          </g>
        ))}

        <path d={path('actual')} className="chart-line actual-line" />
        <path d={path('forecast')} className="chart-line forecast-line" />

        {points.map((point, index) =>
          index % 4 === 0 ? (
            <text
              key={point.hour}
              x={x(index)}
              y={height - 12}
              textAnchor="middle"
              className="axis-label"
            >
              {point.hour.slice(11, 13)}:00
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}

function App() {
  const [actualData, setActualData] = useState([])
  const [forecastData, setForecastData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState('all')
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [actualResponse, forecastResponse] = await Promise.all([
        fetch(`${API}/api/wind/actual`),
        fetch(`${API}/api/wind/forecast`),
      ])

      if (!actualResponse.ok || !forecastResponse.ok) {
        throw new Error('The backend returned an error. Check both API endpoints.')
      }

      const [actualResult, forecastResult] = await Promise.all([
        actualResponse.json(),
        forecastResponse.json(),
      ])

      if (!Array.isArray(actualResult.data) || !Array.isArray(forecastResult.data)) {
        throw new Error('The API response did not contain the expected data arrays.')
      }

      setActualData(actualResult.data)
      setForecastData(forecastResult.data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(
        `${err.message} Make sure the FastAPI server is running at ${API}.`,
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const allRows = useMemo(
    () => buildComparison(actualData, forecastData),
    [actualData, forecastData],
  )

  const availableDates = useMemo(
    () => [...new Set(allRows.map((row) => row.hour.slice(0, 10)))],
    [allRows],
  )

  const rows = useMemo(
    () =>
      selectedDate === 'all'
        ? allRows
        : allRows.filter((row) => row.hour.startsWith(selectedDate)),
    [allRows, selectedDate],
  )

  const metrics = useMemo(() => {
    if (!rows.length) return null

    const mae =
      rows.reduce((sum, row) => sum + Math.abs(row.error), 0) / rows.length

    const rmse = Math.sqrt(
      rows.reduce((sum, row) => sum + row.error ** 2, 0) / rows.length,
    )

    const bias =
      rows.reduce((sum, row) => sum + row.error, 0) / rows.length

    return { mae, rmse, bias, count: rows.length }
  }, [rows])

  const actualCount = actualData.length
  const forecastCount = forecastData.length

  return (
    <main className="dashboard">
      <header className="topbar">
        <a href="#dashboard" className="brand">
          <span className="brand-icon">W</span>
          <span>Wind<span className="brand-light">Scope</span></span>
        </a>

        <div className="topbar-right">
          <span className="period-label">JANUARY 2026</span>
          <button className="refresh-button" onClick={loadData} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh data'}
          </button>
        </div>
      </header>

      <section id="dashboard" className="page-heading">
        <div>
          <p className="eyebrow">ENERGY INTELLIGENCE / UNITED KINGDOM</p>
          <h1>Wind generation dashboard</h1>
          <p className="subtitle">
            Explore wind generation, compare forecasts with actual output, and
            review forecast error.
          </p>
        </div>
        <div className="status-pill">
          <span className={error ? 'status-dot status-error' : 'status-dot'} />
          {error ? 'Connection issue' : loading ? 'Connecting…' : 'API connected'}
        </div>
      </section>

      {error && (
        <section className="error-banner">
          <p>{error}</p>
          <button onClick={loadData}>Try again</button>
        </section>
      )}

      <section className="notice">
        <strong>Evaluation note</strong>
        <span>
          These metrics compare matching delivery hours using the forecast
          records currently returned by the API. They are preliminary, not
          validated day-ahead accuracy results, until forecasts are filtered
          using a verified publication cutoff.
        </span>
      </section>

      <section className="section-heading">
        <div>
          <h2>Generation overview</h2>
          <p>Actual output and forecast performance</p>
        </div>
        <label className="date-filter">
          Delivery date
          <select
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          >
            <option value="all">All January</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {formatDate(date)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-label">Actual records</p>
          <p className="metric-value">{loading ? '…' : formatNumber(actualCount)}</p>
          <p className="metric-foot">Half-hourly API records</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">Forecast records</p>
          <p className="metric-value">
            {loading ? '…' : formatNumber(forecastCount)}
          </p>
          <p className="metric-foot">Hourly API records</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">Mean absolute error</p>
          <p className="metric-value">
            {loading || !metrics ? '—' : formatNumber(metrics.mae)}
          </p>
          <p className="metric-foot">MW · lower is better</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">Forecast bias</p>
          <p className="metric-value">
            {loading || !metrics
              ? '—'
              : `${metrics.bias > 0 ? '+' : ''}${formatNumber(metrics.bias)}`}
          </p>
          <p className="metric-foot">MW · positive means overforecast</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Actual vs forecast generation</h2>
            <p>
              {selectedDate === 'all'
                ? 'First 48 matching delivery hours'
                : `Delivery date: ${formatDate(selectedDate)}`}
            </p>
          </div>
          <div className="chart-legend">
            <span><i className="legend-dot actual-dot" /> Actual</span>
            <span><i className="legend-dot forecast-dot" /> Forecast</span>
          </div>
        </div>

        {loading ? (
          <div className="empty-chart">Loading wind data…</div>
        ) : (
          <LineChart rows={rows} />
        )}
      </section>

      <section className="metric-grid secondary-metrics">
        <article className="metric-card">
          <p className="metric-label">Root mean squared error</p>
          <p className="metric-value">
            {loading || !metrics ? '—' : formatNumber(metrics.rmse)}
          </p>
          <p className="metric-foot">MW · penalizes larger errors</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">Matched hours</p>
          <p className="metric-value">
            {loading ? '…' : formatNumber(metrics?.count ?? 0)}
          </p>
          <p className="metric-foot">Hours with actual and forecast values</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Hourly delivery data</h2>
            <p>Forecast error = forecast generation − actual generation</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Delivery time (UTC)</th>
                <th>Actual (MW)</th>
                <th>Forecast (MW)</th>
                <th>Error (MW)</th>
                <th>Forecast published (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5">Loading data…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="5">No matching records found.</td></tr>
              ) : (
                rows.slice(0, 100).map((row) => (
                  <tr key={row.hour}>
                    <td>{row.hour.replace('T', ' ')}:00Z</td>
                    <td>{formatNumber(row.actual)}</td>
                    <td>{formatNumber(row.forecast)}</td>
                    <td className={row.error > 0 ? 'error-positive' : row.error < 0 ? 'error-negative' : ''}>
                      {row.error > 0 ? '+' : ''}{formatNumber(row.error)}
                    </td>
                    <td>{row.publishTime?.replace('T', ' ') ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 100 && (
          <p className="table-note">Showing the first 100 of {rows.length} matched hours.</p>
        )}
      </section>

      <footer className="footer">
        <span>WindScope · UK wind generation analysis</span>
        <span>
          {lastUpdated
            ? `Data loaded ${lastUpdated.toLocaleTimeString('en-GB')}`
            : 'Waiting for data'}
        </span>
      </footer>
    </main>
  )
}

export default App
