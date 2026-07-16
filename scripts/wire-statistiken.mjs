import fs from 'node:fs'

function patch(file, fn) {
  let s = fs.readFileSync(file, 'utf8')
  const out = fn(s)
  if (out !== s) {
    fs.writeFileSync(file, out)
    console.log('patched', file)
  } else console.log('ok', file)
}

patch('src/i18n/index.ts', (s) => {
  if (/statisticsDe/.test(s)) return s
  s = s.replace(/(import memoryDe from '\.\/locales\/de\/memory\.json')(\r?\n)/, "$1$2import statisticsDe from './locales/de/statistics.json'$2")
  s = s.replace(/(import memoryEn from '\.\/locales\/en\/memory\.json')(\r?\n)/, "$1$2import statisticsEn from './locales/en/statistics.json'$2")
  s = s.replace(/(memory:\s*memoryDe,)(\r?\n)(\s*},)/, '$1$2    statistics: statisticsDe,$2$3')
  s = s.replace(/(memory:\s*memoryEn,)(\r?\n)(\s*},)/, '$1$2    statistics: statisticsEn,$2$3')
  return s
})

patch('src/i18n/locales/de/layout.json', (s) => {
  if (/"statistiken"/.test(s)) return s
  return s.replace(/("meetings":\s*"Meetings")(\r?\n)(\s*})/, '$1,$2      "statistiken": "Statistiken"$2$3')
})

patch('src/i18n/locales/en/layout.json', (s) => {
  if (/"statistiken"/.test(s)) return s
  return s.replace(/("meetings":\s*"Meetings")(\r?\n)(\s*})/, '$1,$2      "statistiken": "Statistics"$2$3')
})

patch('src/components/layout/navConfig.ts', (s) => {
  if (/statistiken\s*:/.test(s)) return s
  return s.replace(
    /(projekte:\s*\{\s*to:\s*'\/projekte',\s*exact:\s*true\s*\},)(\r?\n)(})/,
    "$1$2  statistiken: { to: '/statistiken' },$2$3",
  )
})

patch('src/App.tsx', (s) => {
  if (!/StatistikenPage/.test(s)) {
    s = s.replace(
      /(const MeetingsPage = lazy\(\(\) => import\('\.\/pages\/MeetingsPage'\)\))(\r?\n)/,
      "$1$2const StatistikenPage = lazy(() => import('./pages/StatistikenPage'))$2",
    )
  }
  if (!/\/statistiken/.test(s)) {
    s = s.replace(
      /(<Route path="\/meetings" element=\{<MeetingsPage \/>\} \/>)(\r?\n)/,
      '$1$2        <Route path="/statistiken" element={<StatistikenPage />} />$2        <Route path="/analytics" element={<Navigate to="/statistiken" replace />} />$2',
    )
  }
  return s
})

patch('src/components/layout/Sidebar.tsx', (s) => {
  if (!/BarChart3/.test(s)) s = s.replace(/(Shield,)(\r?\n)(} from)/, '$1$2  BarChart3,$2$3')
  if (!/key:\s*'statistiken'/.test(s)) {
    s = s.replace(
      /(key:\s*'dashboard'[\s\S]*?exact:\s*true\s*},)(\r?\n)(\s*\{ key:\s*'week')/,
      "$1$2    { key: 'statistiken', to: '/statistiken', icon: <BarChart3 size={18} />, label: t('sidebar.nav.statistiken'), visible: true },$2$3",
    )
  }
  if (!/keys:.*statistiken/.test(s)) {
    s = s.replace(
      /keys:\s*\['calendar',\s*'termine',\s*'worktime',\s*'aiScheduler',\s*'meetings'\]/,
      "keys: ['calendar', 'termine', 'worktime', 'statistiken', 'aiScheduler', 'meetings']",
    )
  }
  return s
})

patch('src/components/layout/IconRail.tsx', (s) => {
  if (!/BarChart3/.test(s)) s = s.replace(/(PanelLeft,)(\r?\n)(} from)/, '$1$2  BarChart3,$2$3')
  if (!/statistiken:\s*</.test(s)) {
    s = s.replace(
      /(projekte:\s*<Trello size=\{20\} strokeWidth=\{1\.5\} \/>,)(\r?\n)(})/,
      '$1$2  statistiken: <BarChart3 size={20} strokeWidth={1.5} />,$2$3',
    )
  }
  if (!/DEFAULT_RAIL:[\s\S]*statistiken/.test(s)) {
    s = s.replace(
      /const DEFAULT_RAIL: NavItemKey\[\] = \['dashboard', 'tasks'/,
      "const DEFAULT_RAIL: NavItemKey[] = ['dashboard', 'statistiken', 'tasks'",
    )
  }
  return s
})

patch('src/pages/SettingsPage.tsx', (s) => {
  if (!/BarChart3/.test(s)) s = s.replace('BarChart2, Bell,', 'BarChart2, BarChart3, Bell,')
  if (!/statistiken\s*:/.test(s)) {
    s = s.replace(
      /(projekte:\s*\{\s*icon:\s*<Trello size=\{16\} \/>,\s*label:\s*'Projekte'\s*\},)(\r?\n)(})/,
      "$1$2  statistiken: { icon: <BarChart3 size={16} />, label: 'Statistiken' },$2$3",
    )
  }
  return s
})

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '1.0.18'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'))
lock.version = '1.0.18'
if (lock.packages?.['']) lock.packages[''].version = '1.0.18'
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n')
console.log('version', pkg.version)
