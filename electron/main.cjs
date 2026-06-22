const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

const isDev = !app.isPackaged
const appIconPath = path.join(__dirname, '..', 'public', 'icons', 'icon-512.png')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

// Loading the built app via file:// breaks ES module <script type="module"> imports
// (Chromium blocks them under the file: origin), which is why the window showed blank.
// Serve the same static files over a local HTTP server instead - same content, a real origin.
function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0])
      if (urlPath === '/') urlPath = '/index.html'
      const filePath = path.join(rootDir, urlPath)
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403)
        res.end()
        return
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback: unknown paths (client-side routes) serve index.html
          fs.readFile(path.join(rootDir, 'index.html'), (err2, indexData) => {
            if (err2) {
              res.writeHead(404)
              res.end()
              return
            }
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(indexData)
          })
          return
        }
        const ext = path.extname(filePath)
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
        res.end(data)
      })
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

let staticServer = null

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b0f1a',
    autoHideMenuBar: true,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Open external links (OAuth, etc.) in the system browser instead of inside the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    if (!staticServer) {
      staticServer = await startStaticServer(path.join(__dirname, '..', 'dist-electron-app'))
    }
    const { port } = staticServer.address()
    win.loadURL(`http://127.0.0.1:${port}`)
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (staticServer) staticServer.close()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
