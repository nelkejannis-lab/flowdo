import { useEffect, useState } from 'react'
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, MapPin } from 'lucide-react'

interface WeatherData {
  temp: number
  code: number
  wind: number
  city?: string
}

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

const DE = { lat: 51.1657, lon: 10.4515, city: 'Deutschland' }

async function fetchJson(url: string, ms: number, signal: AbortSignal) {
  const ctrl = new AbortController()
  const combined = AbortSignal.any ? AbortSignal.any([signal, ctrl.signal]) : ctrl.signal
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: combined })
    return await res.json()
  } finally {
    clearTimeout(id)
  }
}

async function getGps(): Promise<{ lat: number; lon: number } | null> {
  if (!navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 300000 },
    )
  })
}

export default function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()

    // Hard 12s timeout — always shows something
    const fallbackTimer = setTimeout(() => {
      if (!ctrl.signal.aborted) {
        setData({ temp: 0, code: 3, wind: 0, city: DE.city })
      }
    }, 12000)

    async function load() {
      let lat = DE.lat
      let lon = DE.lon
      let city: string | undefined = DE.city

      try {
        const json = await fetchJson('https://ipwho.is/', 2000, ctrl.signal)
        if (json?.success && json.latitude && json.longitude) {
          lat = json.latitude
          lon = json.longitude
          city = json.city || json.region || DE.city
        }
      } catch { /* keep DE fallback */ }

      const gps = await getGps()
      if (gps && !ctrl.signal.aborted) {
        lat = gps.lat
        lon = gps.lon
        city = undefined
      }

      if (ctrl.signal.aborted) return

      try {
        const json = await fetchJson(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
          6000,
          ctrl.signal,
        )
        const cw = json?.current_weather
        if (!cw || ctrl.signal.aborted) return

        if (!city) {
          try {
            const geo = await fetchJson(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
              3000,
              ctrl.signal,
            )
            city = geo?.address?.city || geo?.address?.town || geo?.address?.village
          } catch { city = undefined }
        }

        if (!ctrl.signal.aborted) {
          clearTimeout(fallbackTimer)
          setData({ temp: Math.round(cw.temperature), code: cw.weathercode, wind: Math.round(cw.windspeed), city })
        }
      } catch { /* fallback timer will handle it */ }
    }

    load()
    return () => {
      ctrl.abort()
      clearTimeout(fallbackTimer)
    }
  }, [])

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
