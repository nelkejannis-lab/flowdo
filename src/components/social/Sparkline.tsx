interface SparklineProps {
  values: number[]
  color?: string
  width?: number
  height?: number
}

export default function Sparkline({ values, color = '#4772FA', width = 200, height = 48 }: SparklineProps) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-xs text-gray-400">Noch nicht genug Daten</div>
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
