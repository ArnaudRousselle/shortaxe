import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { pointValue, type BalancePoint } from '../lib/balance'
import { formatDayYear, formatEuro, formatMonthShort } from '../lib/format'

const LINE = '#0f766e' // brand-700
const GRID = '#e2e8f0' // slate-200
const AXIS_TEXT = '#64748b' // slate-500
const NEGATIVE = '#dc2626' // red-600

const compactEuro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Graduations « rondes » couvrant [min, max] */
function niceTicks(min: number, max: number, target: number): number[] {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1)
    min -= pad
    max += pad
  }
  const raw = (max - min) / Math.max(1, target)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 100) / 100)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

/** Chemin « en escalier » : le solde change au début de chaque journée */
function stepPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) d += `H${pts[i].x.toFixed(1)}V${pts[i].y.toFixed(1)}`
  return d
}

export function BalanceChart({ points, today }: { points: BalancePoint[]; today: string }) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const narrow = width < 480
  const height = narrow ? 240 : 320
  const m = { top: 12, right: 12, bottom: 40, left: narrow ? 52 : 64 }
  const plotW = Math.max(0, width - m.left - m.right)
  const plotH = height - m.top - m.bottom

  const geo = useMemo(() => {
    if (points.length === 0 || plotW <= 0) return null
    const values = points.flatMap((p) => [p.actual, p.forecast]).filter((v): v is number => v !== null)
    const ticks = niceTicks(Math.min(...values), Math.max(...values), narrow ? 4 : 6)
    const yMin = ticks[0]
    const yMax = ticks[ticks.length - 1]
    const n = points.length
    const x = (i: number) => m.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    const y = (v: number) => m.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH

    const actualPts = points.flatMap((p, i) => (p.actual === null ? [] : [{ x: x(i), y: y(p.actual) }]))
    const forecastPts = points.flatMap((p, i) => (p.forecast === null ? [] : [{ x: x(i), y: y(p.forecast) }]))
    // Le prévisionnel part du solde réel d'aujourd'hui (les échéances en retard créent une marche)
    const todayIdx = points.findIndex((p) => p.date === today)
    if (todayIdx >= 0 && points[todayIdx].actual !== null && forecastPts.length > 0) {
      forecastPts.unshift({ x: x(todayIdx), y: y(points[todayIdx].actual as number) })
    }

    // Repères de mois : 1er de chaque mois, espacés d'au moins ~56 px
    const monthIdx = points.flatMap((p, i) => (p.date.endsWith('-01') ? [i] : []))
    const pxPerMonth = monthIdx.length > 1 ? x(monthIdx[1]) - x(monthIdx[0]) : plotW
    const every = Math.max(1, Math.ceil(56 / Math.max(1, pxPerMonth)))
    const months = monthIdx.filter((_, k) => k % every === 0)

    return { ticks, x, y, actualPts, forecastPts, todayIdx, months, yMin, yMax }
  }, [points, plotW, plotH, m.left, m.top, narrow, today])

  function onMove(e: PointerEvent<SVGRectElement>) {
    if (!geo || points.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / Math.max(1, rect.width)
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))))
  }

  const hp = hover !== null ? points[hover] : null
  const label = points.length
    ? `Évolution du solde du ${formatDayYear(points[0].date)} au ${formatDayYear(points[points.length - 1].date)} : de ${formatEuro(
        pointValue(points[0]),
      )} à ${formatEuro(pointValue(points[points.length - 1]))}`
    : 'Aucune donnée'

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {geo && (
        <svg width={width} height={height} role="img" aria-label={label} className="block">
          {/* Grille et axe des montants */}
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + plotW} y1={geo.y(t)} y2={geo.y(t)} stroke={t === 0 ? NEGATIVE : GRID} strokeOpacity={t === 0 ? 0.5 : 1} strokeDasharray={t === 0 ? '4 3' : undefined} />
              <text x={m.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT} className="tabular-nums">
                {compactEuro.format(t)}
              </text>
            </g>
          ))}
          {geo.yMin < 0 && geo.yMax > 0 && (
            <rect x={m.left} y={geo.y(0)} width={plotW} height={m.top + plotH - geo.y(0)} fill={NEGATIVE} fillOpacity={0.05} />
          )}

          {/* Axe des dates */}
          {geo.months.map((i) => {
            const d = points[i].date
            const showYear = d.slice(5, 7) === '01' || i === geo.months[0]
            return (
              <g key={d}>
                <line x1={geo.x(i)} x2={geo.x(i)} y1={m.top + plotH} y2={m.top + plotH + 4} stroke={AXIS_TEXT} />
                <text x={geo.x(i)} y={m.top + plotH + 16} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                  {formatMonthShort(d)}
                </text>
                {showYear && (
                  <text x={geo.x(i)} y={m.top + plotH + 30} textAnchor="middle" fontSize={11} fill={AXIS_TEXT} fontWeight={600}>
                    {d.slice(0, 4)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Aujourd'hui */}
          {geo.todayIdx >= 0 && (
            <g>
              <line x1={geo.x(geo.todayIdx)} x2={geo.x(geo.todayIdx)} y1={m.top} y2={m.top + plotH} stroke={AXIS_TEXT} strokeDasharray="2 3" />
              <text
                x={geo.x(geo.todayIdx) + (geo.x(geo.todayIdx) > m.left + plotW - 80 ? -4 : 4)}
                y={m.top + 10}
                textAnchor={geo.x(geo.todayIdx) > m.left + plotW - 80 ? 'end' : 'start'}
                fontSize={11}
                fill={AXIS_TEXT}
              >
                Aujourd’hui
              </text>
            </g>
          )}

          {/* Courbes */}
          <path d={stepPath(geo.actualPts)} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
          <path d={stepPath(geo.forecastPts)} fill="none" stroke={LINE} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />

          {/* Survol */}
          {hp && hover !== null && (
            <g pointerEvents="none">
              <line x1={geo.x(hover)} x2={geo.x(hover)} y1={m.top} y2={m.top + plotH} stroke="#94a3b8" />
              <circle cx={geo.x(hover)} cy={geo.y(pointValue(hp))} r={5} fill={LINE} stroke="#fff" strokeWidth={2} />
            </g>
          )}
          <rect
            x={m.left}
            y={m.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}

      {geo && hp && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            top: m.top,
            left: geo.x(hover) > width / 2 ? undefined : geo.x(hover) + 10,
            right: geo.x(hover) > width / 2 ? width - geo.x(hover) + 10 : undefined,
          }}
        >
          <p className="font-medium text-slate-700">{formatDayYear(hp.date)}</p>
          {hp.actual !== null && (hp.forecast === null || hp.forecast !== hp.actual) && (
            <p className="mt-0.5 flex justify-between gap-3">
              <span className="text-slate-500">Réel</span>
              <span className={`font-semibold tabular-nums ${hp.actual < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatEuro(hp.actual)}</span>
            </p>
          )}
          {hp.forecast !== null && (
            <p className="mt-0.5 flex justify-between gap-3">
              <span className="text-slate-500">{hp.date === today && hp.actual === hp.forecast ? 'Solde' : 'Prévu'}</span>
              <span className={`font-semibold tabular-nums ${hp.forecast < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatEuro(hp.forecast)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
