import { useEffect, useRef, useState, useCallback } from 'react'
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, MapPin, Check, X } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

interface WeatherData {
  temp: number
  code: number
  wind: number
}

interface Suggestion {
  display_name: string
  lat: string
  lon: string
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

async function searchPlaces(query: string, signal: AbortSignal): Promise<Suggestion[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&accept-language=de`,
    { signal }
  )
  return res.json()
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

function shortName(s: Suggestion): string {
  // Show city + state + country in a short form
  try {
    const parts = s.display_name.split(', ')
    return parts.slice(0, 3).join(', ')
  } catch {
    return s.display_name
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
  const inputRef = useRef<HTMLInputElement>(null)
  const searchAbort = useRef<AbortController | null>(null)
  const weatherAbort = useRef<AbortController | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (weatherCoords) {
      loadWeatherFromCoords(weatherCoords.lat, weatherCoords.lon)
    }
    return () => weatherAbort.current?.abort()
  }, [weatherCoords])

  async function loadWeatherFromCoords(lat: number, lon: number) {
    weatherAbort.current?.abort()
    weatherAbort.current = new AbortController()
    setData(null)
    const weather = await fetchWeather(lat, lon)
    if (!weatherAbort.current.signal.aborted) setData(weather)
  }

  const searchDebounced = useCallback((query: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    searchAbort.current?.abort()

    if (query.trim().length < 2) {
      setSuggestions([])
      setSearching(false)
      return
    }

    setSearching(true)
    debounceTimer.current = setTimeout(async () => {
      searchAbort.current = new AbortController()
      try {
        const results = await searchPlaces(query, searchAbort.current.signal)
        setSuggestions(results ?? [])
      } catch {
        // aborted or network error
      } finally {
        setSearching(false)
      }
    }, 350)
  }, [])

  function startEdit() {
    setInput(weatherCity)
    setSuggestions([])
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function selectSuggestion(s: Suggestion) {
    const name = shortName(s)
    setWeatherCity(name)
    setWeatherCoords({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) })
    setSuggestions([])
    setEditing(false)
  }

  function cancelEdit() {
    searchAbort.current?.abort()
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    setSuggestions([])
    setEditing(false)
  }

  const Icon = data ? weatherIcon(data.code) : Cloud

  if (editing) {
    return (
      <div className="relative rounded-xl border border-accent bg-white p-4 dark:bg-racing-900">
        <p className="mb-2 text-xs text-gray-400">Stadt oder PLZ eingeben / Enter city or postal code</p>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); searchDebounced(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
            placeholder="z.B. Ennepetal oder 58256"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
          {searching && <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent flex-shrink-0" />}
          <button onClick={cancelEdit} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-gray-100 bg-white shadow-lg dark:border-racing-700 dark:bg-racing-800">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => selectSuggestion(s)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-racing-700 first:rounded-t-xl last:rounded-b-xl"
              >
                <MapPin size={12} className="flex-shrink-0 text-accent" />
                <span className="truncate">{shortName(s)}</span>
              </button>
            ))}
          </div>
        )}

        {input.trim().length >= 2 && !searching && suggestions.length === 0 && (
          <p className="mt-2 text-xs text-gray-400">Keine Ergebnisse / No results</p>
        )}
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
