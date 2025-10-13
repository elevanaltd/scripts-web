#!/usr/bin/env node

/**
 * Bundle Optimization RED State Simulation
 *
 * This script temporarily disables bundle optimization to simulate
 * the RED state for characterization testing.
 *
 * Usage:
 * node scripts/simulate-red-state-bundle.js disable  # Remove optimization
 * node scripts/simulate-red-state-bundle.js enable   # Restore optimization
 */

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const VITE_CONFIG_PATH = join(process.cwd(), 'vite.config.ts')

const OPTIMIZATION_BLOCK = `      output: {
        manualChunks: {
          // Vendor libraries
          'vendor-react': ['react', 'react-dom'],
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-collaboration', '@tiptap/extension-collaboration-cursor'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-router': ['react-router-dom'],
          'vendor-utils': ['zod', 'dompurify', 'yjs']
        }
      }`

const DISABLED_BLOCK = `      output: {
        // DISABLED FOR RED STATE TESTING - manualChunks optimization removed
      }`

async function main() {
  const action = process.argv[2]

  if (!action || !['enable', 'disable'].includes(action)) {
    console.error('Usage: node simulate-red-state-bundle.js [enable|disable]')
    process.exit(1)
  }

  try {
    let content = await readFile(VITE_CONFIG_PATH, 'utf-8')

    if (action === 'disable') {
      // Replace optimization with disabled version
      if (content.includes('manualChunks:')) {
        content = content.replace(/output: \{[\s\S]*?\}/m, DISABLED_BLOCK)
        await writeFile(VITE_CONFIG_PATH, content)
        console.log('✅ Bundle optimization DISABLED - RED state simulated')
        console.log('⚠️  Bundle optimization test should now FAIL')
      } else {
        console.log('⚠️  Bundle optimization already disabled')
      }
    } else if (action === 'enable') {
      // Restore optimization
      if (content.includes('DISABLED FOR RED STATE TESTING')) {
        content = content.replace(/output: \{[\s\S]*?\}/m, OPTIMIZATION_BLOCK)
        await writeFile(VITE_CONFIG_PATH, content)
        console.log('✅ Bundle optimization ENABLED - GREEN state restored')
        console.log('✅ Bundle optimization test should now PASS')
      } else {
        console.log('⚠️  Bundle optimization already enabled')
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()