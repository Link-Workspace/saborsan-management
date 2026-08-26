'use strict'

// ─── Servidor standalone para Electron (substitui `func start`) ──────────────
// Carrega as funções Azure (app.http / app.timer) e as serve via Express.
// Não requer azure-functions-core-tools instalado.

const path   = require('path')
const fs     = require('fs')
const http   = require('http')

// ─── 1. Carrega variáveis de ambiente do local.settings.json ─────────────────
const settingsPath = path.join(__dirname, 'local.settings.json')
if (fs.existsSync(settingsPath)) {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    for (const [k, v] of Object.entries(settings.Values || {})) {
      if (process.env[k] === undefined) process.env[k] = String(v)
    }
  } catch (err) {
    console.error('[server] Falha ao carregar local.settings.json:', err.message)
  }
}

// ─── 2. Intercepta @azure/functions antes de carregar os handlers ─────────────

const httpRoutes = []   // [{ name, expressRoute, methods[], handler }]
const timerJobs  = []   // [{ name, schedule, handler }]

// Converte sintaxe Azure → Express: 'fiscal-benefits/{action?}' → '/api/fiscal-benefits/:action?'
function toExpressRoute(azureRoute) {
  return '/api/' + azureRoute.replace(/\{(\w+)(\?)?\}/g, (_, n, opt) => `:${n}${opt || ''}`)
}

const azFunctionsApp = {
  http: (name, config) => {
    httpRoutes.push({
      name,
      expressRoute: toExpressRoute(config.route || name),
      methods: (config.methods || ['GET', 'POST']).map(m => m.toLowerCase()),
      handler: config.handler,
    })
  },
  timer: (name, config) => {
    timerJobs.push({ name, schedule: config.schedule, handler: config.handler })
  },
  // stubs para tipos de trigger não usados neste contexto
  storageBlob: () => {}, cosmosDB: () => {}, serviceBusTopic: () => {},
  serviceBusQueue: () => {}, eventHub: () => {}, eventGrid: () => {}, generic: () => {},
}

// Resolve o caminho real do módulo dentro de api/node_modules
let azFuncsPath
try {
  azFuncsPath = require.resolve('@azure/functions', { paths: [__dirname] })
} catch {
  azFuncsPath = require.resolve('@azure/functions')
}

delete require.cache[azFuncsPath]
require.cache[azFuncsPath] = {
  id: azFuncsPath, filename: azFuncsPath, loaded: true,
  exports: { app: azFunctionsApp },
  parent: module, children: [], paths: [],
}

// ─── 3. Carrega todos os handlers ─────────────────────────────────────────────
const functionsDir = path.join(__dirname, 'src', 'functions')
for (const file of fs.readdirSync(functionsDir).filter(f => f.endsWith('.js'))) {
  try {
    require(path.join(functionsDir, file))
  } catch (err) {
    console.error(`[server] Erro ao carregar ${file}:`, err.message)
  }
}

// ─── 4. Configura Express ─────────────────────────────────────────────────────
const express = require('express')
const multer  = require('multer')

const app    = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
const PORT   = 7071

// CORS – permite apenas origens localhost (servidor só escuta em 127.0.0.1)
app.use((req, res, next) => {
  const origin = req.headers.origin || ''
  if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin) || origin === 'null') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Forwarded-For,x-signature,x-request-id')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

// Parse de body – multipart, JSON ou binário raw
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || ''
  if (ct.includes('multipart/form-data')) {
    upload.any()(req, res, next)
  } else if (ct.includes('application/json')) {
    express.json({ limit: '50mb' })(req, res, next)
  } else {
    express.raw({ type: '*/*', limit: '50mb' })(req, res, next)
  }
})

// ─── 5. Adaptadores request / response ───────────────────────────────────────

function makeContext(name) {
  return {
    log:   (...a) => console.log(`[${name}]`, ...a),
    warn:  (...a) => console.warn(`[${name}]`, ...a),
    error: (...a) => console.error(`[${name}]`, ...a),
    extraInputs:  { get: () => null },
    extraOutputs: { set: () => {} },
    invocationId: Math.random().toString(36).slice(2),
  }
}

function makeAzureRequest(req) {
  const rawBody   = Buffer.isBuffer(req.body) ? req.body : null
  const parsedBody = rawBody
    ? (() => { try { return JSON.parse(rawBody.toString()) } catch { return null } })()
    : (req.body && typeof req.body === 'object' ? req.body : null)

  // Headers: cria um objeto com get/has/forEach compatível com Azure Functions v4
  const headerEntries = Object.entries(req.headers)
    .filter(([, v]) => v != null)
    .map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(',') : String(v)])
  const headerMap = new Map(headerEntries)
  const headers = {
    get:     k => headerMap.get(k.toLowerCase()) ?? null,
    has:     k => headerMap.has(k.toLowerCase()),
    forEach: cb => headerMap.forEach((v, k) => cb(v, k)),
  }

  const qs = new URLSearchParams(req.originalUrl.split('?')[1] || '')

  return {
    method:  req.method,
    url:     `http://localhost:${PORT}${req.originalUrl}`,
    headers,
    query:   qs,
    params:  req.params || {},

    json: async () => {
      if (parsedBody !== null) return parsedBody
      if (rawBody) return JSON.parse(rawBody.toString())
      return {}
    },
    text: async () => {
      if (rawBody)           return rawBody.toString()
      if (parsedBody !== null) return JSON.stringify(parsedBody)
      return ''
    },
    arrayBuffer: async () => {
      if (rawBody) return rawBody.buffer.slice(rawBody.byteOffset, rawBody.byteOffset + rawBody.byteLength)
      return new ArrayBuffer(0)
    },
    formData: async () => {
      const files = req.files || (req.file ? [req.file] : [])
      return {
        get: name => {
          const f = files.find(f => f.fieldname === name)
          if (f) return {
            name: f.originalname,
            type: f.mimetype,
            size: f.size,
            arrayBuffer: async () =>
              f.buffer.buffer.slice(f.buffer.byteOffset, f.buffer.byteOffset + f.buffer.byteLength),
          }
          return (parsedBody && parsedBody[name]) ?? null
        },
        getAll: name => {
          const matched = (req.files || []).filter(f => f.fieldname === name)
          return matched.map(f => ({
            name: f.originalname, type: f.mimetype, size: f.size,
            arrayBuffer: async () =>
              f.buffer.buffer.slice(f.buffer.byteOffset, f.buffer.byteOffset + f.buffer.byteLength),
          }))
        },
      }
    },
    body: null,
  }
}

async function sendAzureResponse(res, result) {
  if (!result) return res.status(200).end()

  const status = typeof result.status === 'number' ? result.status : 200
  res.status(status)

  for (const [k, v] of Object.entries(result.headers || {})) {
    res.setHeader(k, String(v))
  }

  if (result.jsonBody !== undefined) return res.json(result.jsonBody)
  if (result.body    !== undefined) return res.send(result.body)
  res.end()
}

// ─── 6. Registra rotas HTTP ───────────────────────────────────────────────────
for (const { name, expressRoute, methods, handler } of httpRoutes) {
  for (const method of methods) {
    app[method](expressRoute, async (req, res) => {
      try {
        const result = await handler(makeAzureRequest(req), makeContext(name))
        await sendAzureResponse(res, result)
      } catch (err) {
        console.error(`[${name}] erro não tratado:`, err)
        res.status(500).json({ error: 'Erro interno do servidor.' })
      }
    })
  }
}

// ─── 7. Serve frontend estático (produção Electron) ──────────────────────────
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
}

// Fallback: API inexistente → 404 JSON; qualquer outra rota → SPA
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint não encontrado.' })
  }
  if (fs.existsSync(distPath)) {
    return res.sendFile(path.join(distPath, 'index.html'))
  }
  res.status(404).send('Frontend não encontrado. Execute `npm run build` primeiro.')
})

// ─── 8. Scheduler de timers ───────────────────────────────────────────────────
const _lastFired = new Map()

function matchesCron(expr, date) {
  try {
    const parts = expr.trim().split(/\s+/)
    if (parts.length !== 6) return false
    const [, minF, hourF, domF, monthF, dowF] = parts

    const match = (field, value) => {
      if (field === '*') return true
      if (field.startsWith('*/')) return value % parseInt(field.slice(2)) === 0
      return parseInt(field) === value
    }

    return (
      match(minF,   date.getMinutes()) &&
      match(hourF,  date.getHours()) &&
      match(domF,   date.getDate()) &&
      match(monthF, date.getMonth() + 1) &&
      match(dowF,   date.getDay())
    )
  } catch { return false }
}

function startTimerScheduler() {
  if (!timerJobs.length) return
  setInterval(async () => {
    const now = new Date()
    const minuteKey = `${now.getFullYear()}${now.getMonth()}${now.getDate()}${now.getHours()}${now.getMinutes()}`

    for (const job of timerJobs) {
      const key = `${job.name}:${minuteKey}`
      if (_lastFired.has(key) || !matchesCron(job.schedule, now)) continue
      _lastFired.set(key, true)
      if (_lastFired.size > 500) _lastFired.delete(_lastFired.keys().next().value)

      const ctx = makeContext(job.name)
      ctx.log(`Timer disparado (schedule: ${job.schedule})`)
      try { await job.handler({ scheduleStatus: {}, isPastDue: false }, ctx) }
      catch (err) { ctx.error('Falha no timer:', err) }
    }
  }, 60_000)
}

// ─── 9. Sobe o servidor ───────────────────────────────────────────────────────
let _resolveReady
const readyPromise = new Promise(resolve => { _resolveReady = resolve })

const server = http.createServer(app)
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] API disponível em http://127.0.0.1:${PORT}/api`)
  console.log(`[server] ${httpRoutes.length} rota(s) HTTP | ${timerJobs.length} timer(s) agendado(s)`)
  startTimerScheduler()
  _resolveReady()
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Porta ${PORT} já está em uso. Verifique se outro processo (ex: func start) está rodando.`)
  } else {
    console.error('[server] Falha ao iniciar:', err.message)
  }
  _resolveReady() // resolve para não travar o Electron; a janela vai exibir erro de conexão
})

module.exports = { readyPromise, port: PORT }
