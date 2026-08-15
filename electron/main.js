'use strict'

const { app, BrowserWindow, dialog, Menu, shell } = require('electron')
const path = require('path')

const isDev = !app.isPackaged

// ─── Inicia servidor backend no mesmo processo ────────────────────────────────
// Em desenvolvimento: api/server.js fica ao lado do projeto
// Em produção (empacotado): electron-builder coloca api/ em resources/app/api/
const serverPath = path.join(__dirname, '..', 'api', 'server.js')

let readyPromise = Promise.resolve()
try {
  ;({ readyPromise } = require(serverPath))
} catch (err) {
  readyPromise = Promise.reject(new Error(`Falha ao carregar servidor backend:\n${err.message}`))
}

// ─── Janela principal ─────────────────────────────────────────────────────────
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    title: 'Saborsan Gestão',
    show: false,
    backgroundColor: '#0f172a',
  })

  // Sem menu nativo (app de gestão não precisa)
  Menu.setApplicationMenu(null)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (!isDev) mainWindow.maximize()
  })

  // Dev → Vite dev server; produção → Express serve o build do Vite
  const url = isDev ? 'http://localhost:5174' : 'http://localhost:7071'

  mainWindow.loadURL(url).catch(err => {
    console.error('[main] Erro ao carregar janela:', err.message)
    dialog.showErrorBox('Erro de carregamento', `Não foi possível carregar a interface:\n${err.message}`)
  })

  // Abre DevTools automaticamente em desenvolvimento
  if (isDev) mainWindow.webContents.openDevTools()

  // Links externos abrem no browser padrão, não dentro do app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── Ciclo de vida da aplicação ───────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    await readyPromise
  } catch (err) {
    dialog.showErrorBox('Erro ao iniciar servidor', String(err.message || err))
    app.quit()
    return
  }
  createWindow()
})

app.on('window-all-closed', () => app.quit())

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
