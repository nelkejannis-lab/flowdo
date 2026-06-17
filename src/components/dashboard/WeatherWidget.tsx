import { useEffect, useRef, useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

interface WeatherData {
  temp: number
  tempMax: number
  tempMin: number
  code: number
}

interface Suggestion {
  display_name: string
  lat: string
  lon: string
}

// ─── SVG Weather Icons ────────────────────────────────────────────────────────

function IconSun() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="12" fill="#FFD93D" />
      {[0,45,90,135,180,225,270,315].map((deg, i) => (
        <line key={i}
          x1={28 + 16 * Math.cos(deg * Math.PI/180)}
          y1={28 + 16 * Math.sin(deg * Math.PI/180)}
          x2={28 + 22 * Math.cos(deg * Math.PI/180)}
          y2={28 + 22 * Math.sin(deg * Math.PI/180)}
          stroke="#FFD93D" strokeWidth="2.5" strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

function IconPartlyCloudy() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx="22" cy="22" r="10" fill="#FFD93D" opacity="0.9" />
      {[0,60,120,180,240,300].map((deg, i) => (
        <line key={i}
          x1={22 + 13 * Math.cos(deg * Math.PI/180)}
          y1={22 + 13 * Math.sin(deg * Math.PI/180)}
          x2={22 + 17 * Math.cos(deg * Math.PI/180)}
          y2={22 + 17 * Math.sin(deg * Math.PI/180)}
          stroke="#FFD93D" strokeWidth="2" strokeLinecap="round"
        />
      ))}
      <rect x="10" y="32" width="36" height="14" rx="7" fill="white" opacity="0.95" />
      <circle cx="19" cy="34" r="8" fill="white" opacity="0.95" />
      <circle cx="31" cy="32" r="10" fill="white" opacity="0.95" />
    </svg>
  )
}

function IconCloud() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect x="8" y="30" width="40" height="16" rx="8" fill="white" opacity="0.9" />
      <circle cx="18" cy="32" r="10" fill="white" opacity="0.9" />
      <circle cx="32" cy="28" r="13" fill="white" opacity="0.9" />
    </svg>
  )
}

function IconFog() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect x="8" y="18" width="40" height="14" rx="7" fill="white" opacity="0.7" />
      <circle cx="16" cy="20" r="9" fill="white" opacity="0.7" />
      <circle cx="30" cy="16" r="11" fill="white" opacity="0.7" />
      <rect x="12" y="34" width="32" height="4" rx="2" fill="white" opacity="0.5" />
      <rect x="8" y="41" width="40" height="4" rx="2" fill="white" opacity="0.4" />
    </svg>
  )
}

function IconDrizzle() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect x="8" y="16" width="40" height="16" rx="8" fill="white" opacity="0.9" />
      <circle cx="18" cy="18" r="10" fill="white" opacity="0.9" />
      <circle cx="32" cy="14" r="13" fill="white" opacity="0.9" />
      {[[18,36],[28,40],[38,36],[23,44],[33,44]].map(([x,y],i) => (
        <line key={i} x1={x} y1={y} x2={x-2} y2={y+6} stroke="#93C5FD" strokeWidth="2" strokeLinecap="round"/>
      ))}
    </svg>
  )
}

function IconRain() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect x="6" y="14" width="44" height="17" rx="8.5" fill="white" opacity="0.9" />
      <circle cx="17" cy="16" r="11" fill="white" opacity="0.9" />
      <circle cx="33" cy="12" r="14" fill="white" opacity="0.9" />
      {[[14,36],[24,33],[34,36],[44,33],[19,44],[29,41],[39,44]].map(([x,y],i) => (
        <line key={i} x1={x} y1={y} x2={x-3} y2={y+8} stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round"/>
      ))}
    </svg>
  )
}

function IconSnow() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect x="6" y="14" width="44" height="17" rx="8.5" fill="white" opacity="0.9" />
      <circle cx="17" cy="16" r="11" fill="white" opacity="0.9" />
      <circle cx="33" cy="12" r="14" fill="white" opacity="0.9" />
      {[[16,37],[28,34],[40,37],[22,45],[34,45]].map(([cx,cy],i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="3" fill="white" opacity="0.9"/>
          <line x1={cx-5} y1={cy} x2={cx+5} y2={cy} stroke="white" strokeWidth="1.5" opacity="0.7"/>
          <line x1={cx} y1={cy-5} x2={cx} y2={cy+5} stroke="white" strokeWidth="1.5" opacity="0.7"/>
        </g>
      ))}
    </svg>
  )
}

function IconThunder() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect x="6" y="10" width="44" height="18" rx="9" fill="white" opacity="0.8" />
      <circle cx="17" cy="13" r="11" fill="white" opacity="0.8" />
      <circle cx="33" cy="8" r="14" fill="white" opacity="0.8" />
      <path d="M30 30 L22 44 L29 44 L24 56 L36 38 L29 38 Z" fill="#FBBF24" />
    </svg>
  )
}

function WeatherIcon({ code }: { code: number }) {
  if (code === 0) return <IconSun />
  if (code <= 2) return <IconPartlyCloudy />
  if (code === 3) return <IconCloud />
  if (code <= 49) return <IconFog />
  if (code <= 59) return <IconDrizzle />
  if (code <= 67) return <IconRain />
  if (code <= 77) return <IconSnow />
  if (code <= 82) return <IconRain />
  return <IconThunder />
}

// Gradient background per weather condition
function gradientFor(code: number) {
  if (code === 0) return 'from-[#4A90D9] to-[#87CEEB]'         // clear → blue sky
  if (code <= 2) return 'from-[#5B9BD5] to-[#A8C8E8]'          // partly cloudy
  if (code === 3) return 'from-[#7B8FA8] to-[#A8B8C8]'         // overcast
  if (code <= 49) return 'from-[#8A9BAA] to-[#B8C5CF]'         // fog
  if (code <= 67) return 'from-[#4A6FA8] to-[#7A96BC]'         // rain
  if (code <= 77) return 'from-[#6B8CAE] to-[#A8C0D4]'         // snow
  if (code <= 82) return 'from-[#4A6FA8] to-[#7A96BC]'         // showers
  return 'from-[#3D4F6B] to-[#5A6E8A]'                          // thunder
}

function weatherLabel(code: number) {
  if (code === 0) return 'Klar'
  if (code <= 2) return 'Teilbewölkt'
  if (code === 3) return 'Bewölkt'
  if (code <= 49) return 'Nebel'
  if (code <= 59) return 'Nieselregen'
  if (code <= 67) return 'Regen'
  if (code <= 77) return 'Schnee'
  if (code <= 82) return 'Schauer'
  return 'Gewitter'
}

function shortName(s: Suggestion) {
  return s.display_name.split(', ').slice(0, 3).join(', ')
}

async function searchPlaces(query: string, signal: AbortSignal): Promise<Suggestion[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&accept-language=de`,
    { signal }
  )
  return res.json()
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
      { signal: ctrl.signal }
    )
    const json = await res.json()
    const cw = json?.current_weather
    if (!cw) return null
    return {
      temp: Math.round(cw.temperature),
      tempMax: Math.round(json?.daily?.temperature_2m_max?.[0] ?? cw.temperature),
      tempMin: Math.round(json?.daily?.temperature_2m_min?.[0] ?? cw.temperature),
      code: cw.weathercode,
    }
  } catch {
    return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeatherWidget() {
  const weatherCity = useSettingsStore((s) => s.weatherCity)
  const setWeatherCity = useSettingsStore((s) => s.setWeatherCity)
  const weatherCoords = useSettingsStore((s) => s.weatherCoords)
  const setWeatherCoords = useSettingsStore((s) => s.setWeatherCoords)

  const [data, setData] = useState<WeatherData | null>(null)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchAbort = useRef<AbortController | null>(null)
  const weatherAbort = useRef<AbortController | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (weatherCoords) loadWeather(weatherCoords.lat, weatherCoords.lon)
    return () => weatherAbort.current?.abort()
  }, [weatherCoords])

  async function loadWeather(lat: number, lon: number) {
    weatherAbort.current?.abort()
    weatherAbort.current = new AbortController()
    setData(null)
    const weather = await fetchWeather(lat, lon)
    if (!weatherAbort.current.signal.aborted) setData(weather)
  }

  function onInput(val: string) {
    setInput(val)
    setActiveIdx(-1)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    searchAbort.current?.abort()
    if (val.trim().length < 2) { setSuggestions([]); setSearching(false); return }
    setSearching(true)
    debounceTimer.current = setTimeout(async () => {
      searchAbort.current = new AbortController()
      try {
        const results = await searchPlaces(val, searchAbort.current.signal)
        setSuggestions(results ?? [])
      } catch { /* aborted */ } finally { setSearching(false) }
    }, 300)
  }

  function select(s: Suggestion) {
    const name = shortName(s)
    setWeatherCity(name)
    setWeatherCoords({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) })
    setSuggestions([])
    setEditing(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const target = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0]
      if (target) select(target)
    }
    else if (e.key === 'Escape') { setSuggestions([]); setEditing(false) }
  }

  function startEdit() {
    setInput(weatherCity)
    setSuggestions([])
    setActiveIdx(-1)
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 50)
  }

  // ── Edit mode ──
  if (editing) {
    return (
      <div className="relative rounded-xl border border-accent bg-white p-4 dark:bg-racing-900">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="flex-shrink-0 text-accent" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Stadt oder PLZ eingeben…"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium focus:outline-none"
          />
          {searching
            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent flex-shrink-0" />
            : <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          }
        </div>

        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-[100] mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-racing-700 dark:bg-racing-800">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => { e.preventDefault(); select(s) }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                  i === activeIdx ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50 dark:hover:bg-racing-700'
                } ${i === 0 ? '' : 'border-t border-gray-100 dark:border-racing-700'}`}
              >
                <MapPin size={12} className="flex-shrink-0 text-gray-400" />
                <span className="truncate">{shortName(s)}</span>
              </button>
            ))}
          </div>
        )}

        {input.trim().length >= 2 && !searching && suggestions.length === 0 && (
          <p className="mt-2 text-xs text-gray-400">Keine Ergebnisse gefunden</p>
        )}
      </div>
    )
  }

  // ── Display mode ──
  const gradient = data ? gradientFor(data.code) : 'from-[#7B8FA8] to-[#A8B8C8]'

  return (
    <button
      onClick={startEdit}
      className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-4 text-left text-white transition-all hover:brightness-105 active:brightness-95`}
      title="Klicken um Ort zu ändern"
    >
      {/* City + icon row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1 text-[11px] font-medium text-white/70">
          <MapPin size={10} />
          <span className="truncate max-w-[90px]">{weatherCity}</span>
        </div>
        <div className="absolute right-3 top-2 opacity-90 drop-shadow-sm">
          {data ? <WeatherIcon code={data.code} /> : null}
        </div>
      </div>

      {/* Temperature */}
      {data ? (
        <>
          <div className="mt-7">
            <span className="text-4xl font-semibold tabular-nums leading-none drop-shadow">{data.temp}°</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-xs font-medium text-white/80">{weatherLabel(data.code)}</span>
            <span className="text-[11px] font-medium text-white/70">H:{data.tempMax}° L:{data.tempMin}°</span>
          </div>
        </>
      ) : (
        <div className="mt-7 flex flex-col gap-2">
          <div className="h-9 w-14 animate-pulse rounded bg-white/20" />
          <div className="h-3 w-20 animate-pulse rounded bg-white/20" />
        </div>
      )}
    </button>
  )
}
