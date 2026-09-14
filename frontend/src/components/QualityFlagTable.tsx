import { useMemo, useState } from 'react'
import { FLAG_TYPE_LABELS, type QualityFlag } from '../api'
import './QualityFlagTable.css'

interface QualityFlagTableProps {
  flags: QualityFlag[]
}

export function QualityFlagTable({ flags }: QualityFlagTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [curveFilter, setCurveFilter] = useState<string>('all')

  const types = useMemo(() => Array.from(new Set(flags.map((f) => f.flag_type))).sort(), [flags])
  const curves = useMemo(
    () => Array.from(new Set(flags.map((f) => f.curve).filter((c): c is string => Boolean(c)))).sort(),
    [flags]
  )

  const filtered = flags.filter(
    (f) => (typeFilter === 'all' || f.flag_type === typeFilter) && (curveFilter === 'all' || f.curve === curveFilter)
  )

  if (flags.length === 0) return null

  return (
    <div>
      <div className="gl-flag-filters">
        <label className="gl-filter-label">
          Type
          <select className="gl-input gl-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {FLAG_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        {curves.length > 0 && (
          <label className="gl-filter-label">
            Curve
            <select className="gl-input gl-select" value={curveFilter} onChange={(e) => setCurveFilter(e.target.value)}>
              <option value="all">All curves</option>
              {curves.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="gl-flag-count">
          {filtered.length} of {flags.length}
        </span>
      </div>

      <div className="gl-flag-table-scroll gl-scroll">
        <table className="gl-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Curve</th>
              <th>Depth start</th>
              <th>Depth end</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((flag, i) => (
              <tr key={i}>
                <td>{FLAG_TYPE_LABELS[flag.flag_type]}</td>
                <td className="gl-mono">{flag.curve ?? '—'}</td>
                <td className="gl-mono">{flag.depth_start !== null ? `${flag.depth_start}m` : '—'}</td>
                <td className="gl-mono">{flag.depth_end !== null ? `${flag.depth_end}m` : '—'}</td>
                <td className="gl-flag-detail">{flag.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
