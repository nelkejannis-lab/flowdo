import { useEffect, useRef, useState } from 'react'
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, MapPin } from 'lucide-react'

interface WeatherData {
  temp: number
  code: number
  wind: number
  city?: string
}

const ICONS: Record<string, typeof Sun> = {}

function icon(code: number) {
  if (code === 0) return Sun
  if (code <= 3) return Cloud
  if (code <= 67) return CloudRain
  if (code <= 77) return CloudSnow
  if (code <= 82) return CloudRain
  return CloudLightning
}

function label(code: number) {
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

async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    return res
  } finally {
    clearTimeout(id)
  }
}

// Germany center as reliable fallback
const DE = { lat: 51.1657, lon: 10.4515, city: 'Deutschland' }

export default function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [])

  async function load() {
    let lat = DE.lat
    let lon = DE.lon
    let city: string | undefined = DE.city

    // 1. Try IP geolocation (2s timeout, no GPS prompt)
    try {
      const res = await fetchWithTimeout('https://ipwho.is/', 2000)
      const json = await res.json()
      if (json?.success && json.latitude && json.longitude) {
        lat = json.latitude
        lon = json.longitude
        city = json.city || json.region || DE.city
      }
    } catch { /* use Germany fallback */ }

    // 2. Try GPS silently if already permitted (no popup, instant timeout)
    if (navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude
            lon = pos.coords.longitude
            city = undefined // will reverse-geocode below
            resolve()
          },
          () => resolve(), // denied or unavailable — don't wait
          { timeout: 8000, maximumAge: 300000 }
        )
      })
    }

    // 3. Fetch weather (always succeeds unless network is down)
    try {
      const res = await fetchWithTimeout(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
        5000
      )
      const json = await res.json()
      const cw = json?.current_weather
      if (!cw) return
      if (!mounted.current) return

      // Reverse geocode only if we got GPS (city is undefined)
      if (!city) {
        try {
          const gr = await fetchWithTimeout(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            3000
          )
          const geo = await gr.json()
          city = geo?.address?.city || geo?.address?.town || geo?.address?.village
        } catch { city = undefined }
      }

      if (mounted.current) {
        setData({ temp: Math.round(cw.temperature), code: cw.weathercode, wind: Math.round(cw.windspeed), city })
      }
    } catch { /* network down — widget stays in loading state, no crash */ }
  }

  const Icon = data ? icon(data.code) : Cloud

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      {data ? (
        <>
          <Icon size={32} className="flex-shrink-0 text-sky-400" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{data.temp}°C</span>
              <span className="text-sm text-gray-400">{label(data.code)}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-400">
              {data.city && (
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin size={10} />
                  {data.city}
                </span>
              )}
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
    </div>
  )
}
