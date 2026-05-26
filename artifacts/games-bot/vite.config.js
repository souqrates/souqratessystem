import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.PORT || '5173', 10)
  const basePath = env.BASE_PATH || '/'

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''

  return {
    base: basePath,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    plugins: [
      react(),
      compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
      compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    ],
    publicDir: 'static',
    server: {
      host: '0.0.0.0',
      port,
      allowedHosts: true,
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      sourcemap: false,
      minify: 'esbuild',
      outDir: 'dist/public',
      rollupOptions: {
        input: { main: 'index.html' },
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('zustand')) return 'vendor-state';
            if (id.includes('react-dom')) return 'vendor-react';
            if (id.includes('react/') || id.endsWith('/react')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
  }
})
