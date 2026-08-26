'use strict'
const { contextBridge } = require('electron')

// Expõe apenas o mínimo necessário para o renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
})
