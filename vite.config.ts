import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // الخيار ده بيقفل فحص الـ Host Headers تماماً في Vite ويحل مشكلة ngrok فوراً
    strictPort: false,
    hmr: {
      clientPort: 443
    },
    allowedHosts: true // جرب تمررها كـ true مباشر بدل 'all' أو مصفوفة
  }
})