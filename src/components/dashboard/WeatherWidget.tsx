import { useEffect, useState } from 'react'
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, Thermometer, MapPin } from 'lucide-react'

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
  if (code === 0) return 'Clear sky'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 49) return 'Foggy'
  if (code <= 59) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain showers'
  return 'Thunderstorm'
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) { setError(true); setLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const [meteoRes, geoRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current_weather=true`),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`)
          ])
          const meteo = await meteoRes.json()
          const geo = await geoRes.json()
          const city = geo?.address?.city || geo?.address?.town || geo?.address?.village || geo?.address?.county
          setWeather({
            temp: Math.round(meteo.current_weather.temperature),
            weatherCode: meteo.current_weather.weathercode,
            windspeed: Math.round(meteo.current_weather.windspeed),
            city,
          })
        } catch {
          setError(true)
        } finally {
          setLoading(false)
        }
      },
      () => { setError(true); setLoading(false) }
    )
  }, [])

  if (error || (!loading && !weather)) return null

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100 dark:bg-racing-800" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-100 dark:bg-racing-800" />
      </div>
    )
  }

  const Icon = weatherIcon(weather!.weatherCode)
  const label = weatherLabel(weather!.weatherCode)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <Icon size={32} className="flex-shrink-0 text-sky-400" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold">{weather!.temp}°C</span>
          <span className="text-xs text-gray-400">{label}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-400">
          {weather!.city && (
            <span className="flex items-center gap-0.5 truncate">
              <MapPin size={10} />
              {weather!.city}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Wind size={10} />
            {weather!.windspeed} km/h
          </span>
        </div>
      </div>
      <Thermometer size={14} className="flex-shrink-0 text-gray-300" />
    </div>
  )
}
