'use strict'
const { app } = require('@azure/functions')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execFile } = require('child_process')
const { promisify } = require('util')
const execFileAsync = promisify(execFile)
const sql = require('mssql')

const sqlConfig = {
  server:   process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user:     process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options:  { encrypt: true, trustServerCertificate: false },
}

async function getThermalPrinter() {
  try {
    const pool = await sql.connect(sqlConfig)
    const result = await pool.request().query(`SELECT TOP 1 defaultThermalPrinter FROM DeviceSettings ORDER BY id ASC`)
    return result.recordset[0]?.defaultThermalPrinter || null
  } catch {
    return null
  }
}

function getFocusConfig() {
  const baseUrl = process.env.FOCUS_NFE_BASE_URL
  const token = process.env.FOCUS_NFE_TOKEN
  if (!baseUrl) throw Object.assign(new Error('FOCUS_NFE_BASE_URL não configurada no servidor'), { configError: true })
  if (!token) throw Object.assign(new Error('FOCUS_NFE_TOKEN não configurado no servidor'), { configError: true })
  return { baseUrl: baseUrl.replace(/\/+$/, ''), token }
}

function createBasicAuth(token) {
  return `Basic ${Buffer.from(`${token}:`, 'utf8').toString('base64')}`
}

// pdf-to-printer usa Get-CimInstance cujo output quebra linhas longas sem ':', quebrando o parser.
// Esta função usa Get-Printer | ConvertTo-Json para retorno limpo e confiável.
async function getSystemPrinters() {
  const { stdout } = await execFileAsync('Powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    'Get-Printer | Select-Object Name, Default | ConvertTo-Json -Compress',
  ])
  const raw = stdout.trim()
  if (!raw) return []
  const parsed = JSON.parse(raw)
  const list = Array.isArray(parsed) ? parsed : [parsed]
  return list.map((p) => ({ name: p.Name, isDefault: p.Default === true }))
}

app.http('print-danfe', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (process.platform !== 'win32') {
      return { status: 501, jsonBody: { error: 'Impressão direta disponível apenas em Windows.' } }
    }

    // pdf-to-printer é ESM — carregado dinamicamente para compatibilidade com CJS
    let printerLib
    try {
      printerLib = await import('pdf-to-printer')
    } catch {
      return {
        status: 500,
        jsonBody: { error: 'Módulo de impressão não instalado. Execute: npm install na pasta api.' },
      }
    }

    const { print } = printerLib.default || printerLib

    // ── GET: lista impressoras do sistema ─────────────────────────────────
    if (request.method === 'GET') {
      try {
        const [list, thermalPrinter] = await Promise.all([getSystemPrinters(), getThermalPrinter()])
        const names = list.map((p) => p.name).filter(Boolean)
        const defaultPrinter = list.find((p) => p.isDefault)?.name || names[0] || null
        return { jsonBody: { printers: names, default: defaultPrinter, thermalPrinter } }
      } catch (err) {
        context.error('Erro ao listar impressoras:', err)
        return { status: 500, jsonBody: { error: 'Não foi possível listar as impressoras do sistema.' } }
      }
    }

    // ── POST: imprime o DANFE ─────────────────────────────────────────────
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { reference, printer: printerName } = body

      if (!reference) {
        return { status: 400, jsonBody: { error: 'reference é obrigatório' } }
      }

      let focusConfig
      try {
        focusConfig = getFocusConfig()
      } catch (err) {
        return { status: 503, jsonBody: { error: err.message } }
      }

      // Baixa o PDF do DANFE da Focus NFe
      const nfEndpoint = String(reference).toUpperCase().startsWith('NFCE') ? 'nfce' : 'nfe';
      const danfeUrl = `${focusConfig.baseUrl}/v2/${nfEndpoint}/${encodeURIComponent(reference)}.pdf`
      let pdfBuffer
      try {
        const res = await fetch(danfeUrl, {
          headers: { Authorization: createBasicAuth(focusConfig.token) },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        pdfBuffer = Buffer.from(await res.arrayBuffer())
      } catch (err) {
        context.error('Erro ao baixar DANFE:', err)
        return { status: 502, jsonBody: { error: 'Falha ao baixar DANFE da Focus NFe.' } }
      }

      // Salva em arquivo temporário
      const safeRef = reference.replace(/[^a-z0-9]/gi, '_').slice(0, 40)
      const tempPath = path.join(os.tmpdir(), `danfe_${Date.now()}_${safeRef}.pdf`)
      try {
        fs.writeFileSync(tempPath, pdfBuffer)
      } catch (err) {
        context.error('Erro ao criar arquivo temporário:', err)
        return { status: 500, jsonBody: { error: 'Falha ao criar arquivo temporário para impressão.' } }
      }

      // Envia para a impressora
      try {
        const opts = printerName ? { printer: printerName } : {}
        await print(tempPath, opts)
        return { jsonBody: { success: true } }
      } catch (err) {
        context.error('Erro ao imprimir:', err)
        return { status: 500, jsonBody: { error: `Falha ao enviar para impressora: ${err.message}` } }
      } finally {
        try { fs.unlinkSync(tempPath) } catch (_) {}
      }
    }
  },
})
