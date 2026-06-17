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

function weatherEmoji(code: number) {
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅'
  if (code === 3) return '☁️'
  if (code <= 49) return '🌫️'
  if (code <= 59) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌨️'
  return '⛈️'
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
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        select(suggestions[activeIdx])
      } else if (suggestions.length > 0) {
        select(suggestions[0])
      }
    } else if (e.key === 'Escape') {
      setSuggestions([])
      setEditing(false)
    }
  }

  function startEdit() {
    setInput(weatherCity)
    setSuggestions([])
    setActiveIdx(-1)
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 50)
  }

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
                } ${i === 0 ? 'rounded-t-xl' : ''} ${i === suggestions.length - 1 ? 'rounded-b-xl' : 'border-b border-gray-100 dark:border-racing-700'}`}
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

  return (
    <button
      onClick={startEdit}
      className="group flex w-full flex-col justify-between rounded-xl border border-gray-100 bg-white p-4 text-left transition-colors hover:border-accent dark:border-racing-800 dark:bg-racing-900 dark:hover:border-accent"
    >
      {data ? (
        <>
          {/* Top row: city + emoji */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1 text-[11px] text-gray-400 group-hover:text-accent">
              <MapPin size={10} />
              <span className="truncate">{weatherCity}</span>
            </div>
            <span className="text-xl leading-none">{weatherEmoji(data.code)}</span>
          </div>

          {/* Temperature */}
          <div className="mt-1">
            <span className="text-3xl font-semibold tabular-nums leading-none">{data.temp}°</span>
          </div>

          {/* Condition + max/min */}
          <div className="mt-1 flex items-end justify-between">
            <span className="text-xs text-gray-500">{weatherLabel(data.code)}</span>
            <span className="text-[11px] text-gray-400">
              H:{data.tempMax}° L:{data.tempMin}°
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="h-3 w-20 animate-pulse rounded bg-gray-100 dark:bg-racing-800" />
          <div className="h-8 w-14 animate-pulse rounded bg-gray-100 dark:bg-racing-800" />
          <div className="h-3 w-28 animate-pulse rounded bg-gray-100 dark:bg-racing-800" />
        </div>
      )}
    </button>
  )
}
