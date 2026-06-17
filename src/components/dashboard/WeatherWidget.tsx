import { useEffect, useRef, useState } from 'react'
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, MapPin, Check, X } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

interface WeatherData {
  temp: number
  code: number
  wind: number
}

function weatherIcon(code: number) {
  if (code === 0) return Sun
  if (code <= 3) return Cloud
  if (code <= 67) return CloudRain
  if (code <= 77) return CloudSnow
  if (code <= 82) return CloudRain
  return CloudLightning
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

async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { signal: ctrl.signal }
    )
    const json = await res.json()
    if (!json?.[0]) return null
    return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) }
  } catch {
    return null
  }
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
      { signal: ctrl.signal }
    )
    const json = await res.json()
    const cw = json?.current_weather
    if (!cw) return null
    return { temp: Math.round(cw.temperature), code: cw.weathercode, wind: Math.round(cw.windspeed) }
  } catch {
    return null
  }
}

export default function WeatherWidget() {
  const weatherCity = useSettingsStore((s) => s.weatherCity)
  const setWeatherCity = useSettingsStore((s) => s.setWeatherCity)

  const [data, setData] = useState<WeatherData | null>(null)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    loadWeather(weatherCity)
    return () => abortRef.current?.abort()
  }, [weatherCity])

  async function loadWeather(city: string) {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setData(null)
    const coords = await geocode(city)
    if (!coords || abortRef.current.signal.aborted) return
    const weather = await fetchWeather(coords.lat, coords.lon)
    if (!abortRef.current.signal.aborted) setData(weather)
  }

  function startEdit() {
    setInput(weatherCity)
    setError(false)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function confirmEdit() {
    const city = input.trim()
    if (!city) { setEditing(false); return }
    setLoading(true)
    setError(false)
    const coords = await geocode(city)
    setLoading(false)
    if (!coords) { setError(true); return }
    setWeatherCity(city)
    setEditing(false)
  }

  function cancelEdit() {
    setEditing(false)
    setError(false)
  }

  const Icon = data ? weatherIcon(data.code) : Cloud

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-accent bg-white p-4 dark:bg-racing-900">
        <p className="text-xs text-gray-400">Stadt eingeben / Enter city</p>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit() }}
            placeholder="z.B. Eneppetal"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
          <button
            onClick={confirmEdit}
            disabled={loading}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {loading
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              : <Check size={14} />}
          </button>
          <button onClick={cancelEdit} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
        {error && <p className="text-xs text-red-400">Stadt nicht gefunden / City not found</p>}
      </div>
    )
  }

  return (
    <button
      onClick={startEdit}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left transition-colors hover:border-accent dark:border-racing-800 dark:bg-racing-900 dark:hover:border-accent"
      title="Klicken um Ort zu ändern / Click to change city"
    >
      {data ? (
        <>
          <Icon size={32} className="flex-shrink-0 text-sky-400" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{data.temp}°C</span>
              <span className="text-sm text-gray-400">{weatherLabel(data.code)}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-0.5 truncate">
                <MapPin size={10} />
                {weatherCity}
              </span>
              <span className="flex items-center gap-0.5">
                <Wind size={10} />
                {data.wind} km/h
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100 dark:bg-racing-800" />
          <div className="flex flex-col gap-1.5">
            <div className="h-5 w-16 animate-pulse rounded bg-gray-100 dark:bg-racing-800" />
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-racing-800" />
          </div>
        </>
      )}
    </button>
  )
}
