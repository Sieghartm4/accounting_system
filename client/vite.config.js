import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: parseInt(env.PORT) || 3000,
      host: true,
    },
    preview: {
      port: parseInt(env.PORT) || 8080,
      host: true,
      allowedHosts: true,
    },
  }
})
