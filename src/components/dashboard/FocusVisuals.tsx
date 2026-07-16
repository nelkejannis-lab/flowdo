/** Shared visual primitives for Focus Horizon / bento dashboards */

export function SegmentedBar({
  value,
  max = 100,
  segments = 12,
  className = '',
}: {
  value: number
  max?: number
  segments?: number
  className?: string
}) {
  const filled = Math.max(0, Math.min(segments, Math.round((value / Math.max(max, 1)) * segments)))
  return (
    <div className={`segmented-bar ${className}`} role="img" aria-label={`${Math.round((value / Math.max(max, 1)) * 100)}%`}>
      {Array.from({ length: segments }).map((_, i) => (
        <span key={i} className={i < filled ? 'is-filled' : undefined} />
      ))}
    </div>
  )
}

export function AvatarStack({
  people,
  max = 4,
}: {
  people: { id: string; name: string; avatarUrl?: string; color?: string }[]
  max?: number
}) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  if (people.length === 0) return null
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <div
          key={p.id}
          className="relative h-7 w-7 overflow-hidden rounded-full ring-2 ring-white dark:ring-racing-900"
          style={{ marginLeft: i === 0 ? 0 : -8, zIndex: shown.length - i }}
          title={p.name}
        >
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: p.color ?? '#6B46FE' }}
            >
              {p.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      ))}
      {rest > 0 && (
        <span
          className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold text-gray-600 ring-2 ring-white dark:bg-racing-700 dark:text-racing-100 dark:ring-racing-900"
          style={{ marginLeft: -8 }}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

export function DonutChart({
  segments,
  size = 120,
  stroke = 12,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string }[]
  size?: number
  stroke?: number
  centerLabel?: string
  centerSub?: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * c
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          )
          offset += len
          return el
        })}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel && <span className="text-2xl font-bold tabular-nums leading-none">{centerLabel}</span>}
          {centerSub && <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">{centerSub}</span>}
        </div>
      )}
    </div>
  )
}
