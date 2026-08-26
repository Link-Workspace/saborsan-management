import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Em build Electron (ELECTRON_BUILD=true) usa '/' para funcionar com Express/file://
  // No deploy web normal mantém o subpath original
  base: process.env.ELECTRON_BUILD ? '/' : '/saborsan-management/',
  server: {
    port: 5174,
  },
})
