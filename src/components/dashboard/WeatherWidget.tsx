import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, X, Locate } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { format } from 'date-fns'
import { de, enUS, type Locale } from 'date-fns/locale'
import { useSettingsStore } from '../../store/settingsStore'

interface HourlyPoint {
  time: string // HH:MM
  temp: number
  code: number
}

interface DailyPoint {
  label: string // e.g. "Mo", "Di"
  tempMax: number
  tempMin: number
  code: number
}

interface WeatherData {
  temp: number
  tempMax: number
  tempMin: number
  code: number
  hourly: HourlyPoint[]
  daily: DailyPoint[]
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

function weatherLabel(code: number, t: TFunction) {
  if (code === 0) return t('weatherWidget.conditions.clear')
  if (code <= 2) return t('weatherWidget.conditions.partlyCloudy')
  if (code === 3) return t('weatherWidget.conditions.cloudy')
  if (code <= 49) return t('weatherWidget.conditions.fog')
  if (code <= 59) return t('weatherWidget.conditions.drizzle')
  if (code <= 67) return t('weatherWidget.conditions.rain')
  if (code <= 77) return t('weatherWidget.conditions.snow')
  if (code <= 82) return t('weatherWidget.conditions.showers')
  return t('weatherWidget.conditions.thunder')
}

function shortName(s: Suggestion) {
  return s.display_name.split(', ').slice(0, 3).join(', ')
}

async function searchPlaces(query: string, signal: AbortSignal, language: string): Promise<Suggestion[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${language}&format=json`,
    { signal }
  )
  const data = await res.json()
  return (data.results ?? []).map((item: any) => ({
    display_name: `${item.name}${item.admin1 ? `, ${item.admin1}` : ''}, ${item.country}`,
    lat: String(item.latitude),
    lon: String(item.longitude),
  }))
}

async function fetchWeather(lat: number, lon: number, dateLocale: Locale): Promise<WeatherData | null> {
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&hourly=temperature_2m,weather_code&forecast_days=7&timezone=auto&models=best_match`,
      { signal: ctrl.signal }
    )
    const json = await res.json()
    const current = json?.current
    if (!current) return null

    // Build next 6 hourly points from current time
    // Treat all ISO local time strings from Open-Meteo as UTC to handle them timezone-independently
    const currentT = new Date(current.time + 'Z')
    const times: string[] = json?.hourly?.time ?? []
    const temps: number[] = json?.hourly?.temperature_2m ?? []
    const codes: number[] = json?.hourly?.weather_code ?? []
    const hourly: HourlyPoint[] = []

    for (let i = 0; i < times.length && hourly.length < 6; i++) {
      const hourlyT = new Date(times[i] + 'Z')
      const hourlyDiffHours = (hourlyT.getTime() - currentT.getTime()) / (1000 * 60 * 60)
      
      // Skip past hours (i.e. if the hourly slot is before or equal to current time)
      if (hourlyDiffHours <= 0) continue
      
      const h = hourlyT.getUTCHours()
      hourly.push({ 
        time: `${String(h).padStart(2, '0')}:00`, 
        temp: Math.round(temps[i]), 
        code: codes[i] 
      })
    }

    // Build 7-day daily forecast (skip today = index 0)
    const dailyDates: string[] = json?.daily?.time ?? []
    const dailyMax: number[] = json?.daily?.temperature_2m_max ?? []
    const dailyMin: number[] = json?.daily?.temperature_2m_min ?? []
    const dailyCodes: number[] = json?.daily?.weather_code ?? []
    const daily: DailyPoint[] = dailyDates.slice(1, 7).map((dateStr, i) => {
      const dailyDate = new Date(dateStr + 'T00:00:00Z')
      return {
        label: format(dailyDate, 'EEE', { locale: dateLocale }),
        tempMax: Math.round(dailyMax[i + 1] ?? 0),
        tempMin: Math.round(dailyMin[i + 1] ?? 0),
        code: dailyCodes[i + 1] ?? 0,
      }
    })

    return {
      temp: Math.round(current.temperature_2m),
      tempMax: Math.round(json?.daily?.temperature_2m_max?.[0] ?? current.temperature_2m),
      tempMin: Math.round(json?.daily?.temperature_2m_min?.[0] ?? current.temperature_2m),
      code: current.weather_code,
      hourly,
      daily,
    }
  } catch {
    return null
  }
}

// Small inline icon for hourly forecast
function SmallWeatherIcon({ code }: { code: number }) {
  const color = code === 0 ? '#FFD93D' : code <= 2 ? '#FFD93D' : code <= 3 ? '#9CA3AF' : code <= 49 ? '#9CA3AF' : '#60A5FA'
  if (code === 0) return <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill={color}/>{[0,45,90,135,180,225,270,315].map((d,i)=><line key={i} x1={8+5*Math.cos(d*Math.PI/180)} y1={8+5*Math.sin(d*Math.PI/180)} x2={8+7*Math.cos(d*Math.PI/180)} y2={8+7*Math.sin(d*Math.PI/180)} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>)}</svg>
  if (code <= 2) return <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="6" cy="6" r="3" fill="#FFD93D"/><ellipse cx="9" cy="10" rx="5" ry="3" fill="white" opacity="0.9"/><circle cx="6" cy="9" rx="3" ry="3" fill="white" opacity="0.9"/></svg>
  if (code <= 67) return <svg width="16" height="16" viewBox="0 0 16 16"><ellipse cx="8" cy="7" rx="6" ry="4" fill="#9CA3AF"/>{code > 49 && <><line x1="5" y1="12" x2="4" y2="15" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="12" x2="8" y2="15" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round"/></>}</svg>
  return <svg width="16" height="16" viewBox="0 0 16 16"><ellipse cx="8" cy="7" rx="6" ry="4" fill="#9CA3AF"/></svg>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeatherWidget() {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const weatherCity = useSettingsStore((s) => s.weatherCity)
  const setWeatherCity = useSettingsStore((s) => s.setWeatherCity)
  const weatherCoords = useSettingsStore((s) => s.weatherCoords)
  const setWeatherCoords = useSettingsStore((s) => s.setWeatherCoords)
  const weatherGpsAsked = useSettingsStore((s) => s.weatherGpsAsked)
  const setWeatherGpsAsked = useSettingsStore((s) => s.setWeatherGpsAsked)

  const [data, setData] = useState<WeatherData | null>(null)
  const [editing, setEditing] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [locating, setLocating] = useState(false)

  async function detectLocation(silent = false) {
    if (!navigator.geolocation) {
      if (!silent) alert(t('weatherWidget.geoNotSupported'))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords
        setWeatherCoords({ lat, lon })
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=${i18n.language}`
          )
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.suburb || t('weatherWidget.myLocation')
          setWeatherCity(city)
        } catch {
          setWeatherCity(t('weatherWidget.myLocation'))
        } finally {
          setLocating(false)
          setEditing(false)
        }
      },
      (error) => {
        console.error(error)
        if (!silent) alert(t('weatherWidget.locationNotDetermined'))
        setLocating(false)
      },
      { timeout: 8000 }
    )
  }
  const inputRef = useRef<HTMLInputElement>(null)
  const editContainerRef = useRef<HTMLDivElement>(null)
  const searchAbort = useRef<AbortController | null>(null)
  const weatherAbort = useRef<AbortController | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (weatherCoords) loadWeather(weatherCoords.lat, weatherCoords.lon)
    return () => weatherAbort.current?.abort()
  }, [weatherCoords, i18n.language])

  // On first ever use, try to locate the user via GPS so the weather reflects their
  // actual position out of the box. Only attempted once (the browser asks for permission
  // once); after that the user can refresh the location manually via the GPS button.
  useEffect(() => {
    if (weatherGpsAsked) return
    setWeatherGpsAsked()
    if (navigator.geolocation) void detectLocation(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadWeather(lat: number, lon: number) {
    weatherAbort.current?.abort()
    weatherAbort.current = new AbortController()
    setData(null)
    const weather = await fetchWeather(lat, lon, dateLocale)
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
        const results = await searchPlaces(val, searchAbort.current.signal, i18n.language)
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

  useLayoutEffect(() => {
    if (suggestions.length > 0 && editContainerRef.current) {
      const rect = editContainerRef.current.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    } else {
      setDropdownRect(null)
    }
  }, [suggestions])

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
      <div ref={editContainerRef} className="rounded-xl border border-accent bg-white p-4 dark:bg-racing-900">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="flex-shrink-0 text-accent" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('weatherWidget.cityPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium focus:outline-none"
          />
          <button
            type="button"
            onClick={() => detectLocation()}
            disabled={locating}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-accent dark:hover:bg-racing-800 transition-colors disabled:opacity-50 flex-shrink-0"
            title={t('weatherWidget.useCurrentLocation')}
          >
            {locating ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent block" />
            ) : (
              <Locate size={14} />
            )}
          </button>
          {searching
            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent flex-shrink-0" />
            : <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={14} /></button>
          }
        </div>

        {dropdownRect && suggestions.length > 0 && createPortal(
          <div
            style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 9999 }}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => { e.preventDefault(); select(s) }}
                onTouchStart={(e) => { e.preventDefault(); select(s) }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                  i === activeIdx ? 'bg-blue-50 text-blue-600' : 'bg-white hover:bg-gray-50'
                } ${i === 0 ? '' : 'border-t border-gray-100'}`}
              >
                <MapPin size={12} className="flex-shrink-0 text-gray-400" />
                <span className="truncate text-gray-800">{shortName(s)}</span>
              </button>
            ))}
          </div>,
          document.body
        )}

        {input.trim().length >= 2 && !searching && suggestions.length === 0 && (
          <p className="mt-2 text-xs text-gray-400">{t('weatherWidget.noResults')}</p>
        )}
      </div>
    )
  }

  // ── Display mode ──
  const gradient = data ? gradientFor(data.code) : 'from-[#7B8FA8] to-[#A8B8C8]'

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-4 text-left text-white transition-all hover:brightness-105 active:brightness-95`}
        title={t('weatherWidget.clickForDetails')}
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
              <span className="text-xs font-medium text-white/80">{weatherLabel(data.code, t)}</span>
              <span className="text-[11px] font-medium text-white/70">H:{data.tempMax}° L:{data.tempMin}°</span>
            </div>
            {/* 5h hourly forecast bar */}
            {data.hourly.length > 0 && (
              <div className="mt-3 flex items-end justify-between border-t border-white/20 pt-2">
                {data.hourly.map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-semibold text-white/90">{h.temp}°</span>
                    <SmallWeatherIcon code={h.code} />
                    <span className="text-[9px] text-white/60">{h.time}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="mt-7 flex flex-col gap-2">
            <div className="h-9 w-14 animate-pulse rounded bg-white/20" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/20" />
          </div>
        )}
      </button>

      {/* Detail modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetail(false)} />
          <div className={`relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-2xl`}>
            <div className="flex items-center justify-between p-4 pb-0">
              <div className="flex items-center gap-1.5 text-sm font-medium text-white/80">
                <MapPin size={14} />
                <span>{weatherCity}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDetail(false); startEdit() }}
                  className="flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
                >
                  <MapPin size={11} /> {t('weatherWidget.changeLocation')}
                </button>
                <button onClick={() => setShowDetail(false)} className="rounded-lg p-1 hover:bg-white/20">
                  <X size={18} />
                </button>
              </div>
            </div>

            {data && (
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-6xl font-light tabular-nums">{data.temp}°</div>
                    <div className="mt-1 text-lg font-medium text-white/80">{weatherLabel(data.code, t)}</div>
                    <div className="mt-0.5 text-sm text-white/60">H:{data.tempMax}° · T:{data.tempMin}°</div>
                  </div>
                  <WeatherIcon code={data.code} />
                </div>

                {data.hourly.length > 0 && (
                  <div className="mt-5 border-t border-white/20 pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">{t('weatherWidget.nextHours')}</p>
                    <div className="flex justify-between">
                      {data.hourly.map((h, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold">{h.temp}°</span>
                          <SmallWeatherIcon code={h.code} />
                          <span className="text-[10px] text-white/60">{h.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.daily.length > 0 && (
                  <div className="mt-4 border-t border-white/20 pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">{t('weatherWidget.next6Days')}</p>
                    <div className="space-y-1.5">
                      {data.daily.map((d, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-7 text-xs font-semibold text-white/80">{d.label}</span>
                          <SmallWeatherIcon code={d.code} />
                          <span className="flex-1 text-xs text-white/60">{weatherLabel(d.code, t)}</span>
                          <span className="text-xs font-semibold">{d.tempMax}°</span>
                          <span className="text-xs text-white/50">{d.tempMin}°</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
