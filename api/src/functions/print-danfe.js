'use strict'
const { app } = require('@azure/functions')
const path = require('path')
const fs = require('fs')
const os = require('os')

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

    const { print, getPrinters } = printerLib.default || printerLib

    // ── GET: lista impressoras do sistema ─────────────────────────────────
    if (request.method === 'GET') {
      try {
        const list = await getPrinters()
        const names = list.map((p) => p.deviceName || p.name || String(p)).filter(Boolean)
        const defaultPrinter = list.find((p) => p.isDefault)?.deviceName || names[0] || null
        return { jsonBody: { printers: names, default: defaultPrinter } }
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
      const danfeUrl = `${focusConfig.baseUrl}/v2/nfe/${encodeURIComponent(reference)}.pdf`
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
