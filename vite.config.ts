import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')

  // Test environment: Use fallback credentials for import.meta.env injection
  const testEnv = process.env.CI ? {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://test-project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MTU2MTY4MDB9.test-mock-anon-key',
    VITE_SMARTSUITE_API_KEY: process.env.VITE_SMARTSUITE_API_KEY || 'test-mock-smartsuite-key',
    VITE_SMARTSUITE_WORKSPACE_ID: process.env.VITE_SMARTSUITE_WORKSPACE_ID || 's3qnmox1',
    VITE_SMARTSUITE_PROJECTS_TABLE: process.env.VITE_SMARTSUITE_PROJECTS_TABLE || '68a8ff5237fde0bf797c05b3',
    VITE_SMARTSUITE_VIDEOS_TABLE: process.env.VITE_SMARTSUITE_VIDEOS_TABLE || '68b2437a8f1755b055e0a124',
  } : {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
  }

  return {
  plugins: [react()],

  // CRITICAL: Define import.meta.env.* for test environment
  // Vite's `define` replaces these at compile time (works in both dev and test)
  // Without this, import.meta.env.VITE_SUPABASE_URL is undefined in tests
  define: mode === 'test' ? {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(testEnv.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(testEnv.VITE_SUPABASE_PUBLISHABLE_KEY),
    'import.meta.env.VITE_SMARTSUITE_API_KEY': JSON.stringify(testEnv.VITE_SMARTSUITE_API_KEY),
    'import.meta.env.VITE_SMARTSUITE_WORKSPACE_ID': JSON.stringify(testEnv.VITE_SMARTSUITE_WORKSPACE_ID),
    'import.meta.env.VITE_SMARTSUITE_PROJECTS_TABLE': JSON.stringify(testEnv.VITE_SMARTSUITE_PROJECTS_TABLE),
    'import.meta.env.VITE_SMARTSUITE_VIDEOS_TABLE': JSON.stringify(testEnv.VITE_SMARTSUITE_VIDEOS_TABLE),
  } : {},
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libraries
          'vendor-react': ['react', 'react-dom'],
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-collaboration', '@tiptap/extension-collaboration-cursor'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-router': ['react-router-dom'],
          'vendor-utils': ['zod', 'dompurify', 'yjs']
        }
      }
    },
    chunkSizeWarningLimit: 500
  },
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api/smartsuite': {
        target: 'https://app.smartsuite.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/smartsuite/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Add SmartSuite headers for development
            const apiKey = env.VITE_SMARTSUITE_API_KEY || '';

            // Debug: Log API key status (not the key itself)
            if (!apiKey) {
              console.error('[Dev Proxy] WARNING: No API key found!');
            } else {
              console.log('[Dev Proxy] API key loaded');
            }

            proxyReq.setHeader('Authorization', `Token ${apiKey}`);
            proxyReq.setHeader('ACCOUNT-ID', 's3qnmox1');
            proxyReq.setHeader('Content-Type', 'application/json');

            // Log the request for debugging
            console.log(`[Dev Proxy] ${req.method} ${req.url}`);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log(`[Dev Proxy Response] ${proxyRes.statusCode} for ${req.url}`);
          });
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,

    // Memory optimization: Limit worker threads to prevent RAM exhaustion
    // Without this, Vitest spawns workers equal to CPU cores (often 12+)
    // Each worker + jsdom environment = ~400-600MB
    // See: coordination/planning-docs/005-VITEST-MEMORY-OPTIMIZATION.md
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,      // Limit concurrent test workers
        minThreads: 1,      // Keep at least one thread alive
        singleThread: false // Allow parallelism within limits
      }
    }

    // NOTE: Environment variable injection moved to `define` block above
    // This ensures import.meta.env.* is available during module imports
    // See lines 29-36 for the actual injection mechanism
  }
  }
})