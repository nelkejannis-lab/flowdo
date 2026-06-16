import { useEffect, useState } from 'react'
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, MapPin } from 'lucide-react'

interface WeatherData {
  temp: number
  weatherCode: number
  windspeed: number
  city?: string
}

function weatherIcon(code: number) {
  if (code === 0) return Sun
  if (code <= 3) return Cloud
  if (code <= 67) return CloudRain
  if (code <= 77) return CloudSnow
  if (code <= 82) return CloudRain
  if (code <= 99) return CloudLightning
  return Cloud
}

function weatherLabel(code: number): string {
  if (code === 0) return 'Klar'
  if (code <= 2) return 'Teilweise bewölkt'
  if (code === 3) return 'Bewölkt'
  if (code <= 49) return 'Nebelig'
  if (code <= 59) return 'Nieselregen'
  if (code <= 67) return 'Regen'
  if (code <= 77) return 'Schnee'
  if (code <= 82) return 'Regenschauer'
  return 'Gewitter'
}

async function fetchWeather(lat: number, lon: number): Promise<Omit<WeatherData, 'city'>> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
  )
  const json = await res.json()
  return {
    temp: Math.round(json.current_weather.temperature),
    weatherCode: json.current_weather.weathercode,
    windspeed: Math.round(json.current_weather.windspeed),
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    )
    const json = await res.json()
    return json?.address?.city || json?.address?.town || json?.address?.village || json?.address?.county
  } catch {
    return undefined
  }
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Default: center of Germany (always valid)
      let lat = 51.1657
      let lon = 10.4515

      // 1. Try GPS
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          )
          lat = pos.coords.latitude
          lon = pos.coords.longitude
        } catch { /* denied or timeout — keep default */ }
      }

      // 2. IP fallback via ipwho.is if still at default
      if (lat === 51.1657) {
        try {
          const res = await fetch('https://ipwho.is/')
          const json = await res.json()
          if (json?.latitude && json?.longitude) {
            lat = json.latitude
            lon = json.longitude
          }
        } catch { /* blocked — keep default */ }
      }

      try {
        const [data, city] = await Promise.all([
          fetchWeather(lat, lon),
          reverseGeocode(lat, lon),
        ])
        if (!cancelled) {
          setWeather({ ...data, city })
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100 dark:bg-racing-800" />
        <div className="flex flex-col gap-1.5">
          <div className="h-5 w-16 animate-pulse rounded bg-gray-100 dark:bg-racing-800" />
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-racing-800" />
        </div>
      </div>
    )
  }

  if (!weather) return null

  const Icon = weatherIcon(weather.weatherCode)
  const label = weatherLabel(weather.weatherCode)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <Icon size={32} className="flex-shrink-0 text-sky-400" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold">{weather.temp}°C</span>
          <span className="text-sm text-gray-400">{label}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-400">
          {weather.city && (
            <span className="flex items-center gap-0.5 truncate">
              <MapPin size={10} />
              {weather.city}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Wind size={10} />
            {weather.windspeed} km/h
          </span>
        </div>
      </div>
    </div>
  )
}
