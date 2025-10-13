/**
 * Bundle Optimization Characterization Test
 *
 * TDD REMEDIATION: This test characterizes the bundle optimization implementation
 * that was added in Checkpoint 3 without proper TDD discipline.
 *
 * Protocol: Red-Green-Refactor Retroactively
 * 1. SIMULATE RED: Disable optimization in vite.config.ts
 * 2. ESTABLISH CONTRACT: Write failing test for bundle requirements
 * 3. GO GREEN: Re-enable optimization, test must pass
 * 4. REGRESSION GUARD: Test permanently prevents optimization removal
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { stat } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'

describe('Bundle Optimization Characterization', () => {
  let buildOutput: string
  let assetsPath: string

  beforeAll(async () => {
    buildOutput = join(process.cwd(), 'dist')
    assetsPath = join(buildOutput, 'assets')
  })

  /**
   * CONTRACT: Bundle must be optimized with proper code splitting
   *
   * This test ensures that:
   * 1. Build process creates vendor chunks for major dependencies
   * 2. Main app bundle stays under size limit
   * 3. Code splitting is working as configured
   *
   * RED STATE SIMULATION: If vite.config.ts manualChunks is removed,
   * this test MUST FAIL by detecting missing vendor chunks
   */
  it('should create optimized vendor chunks for major dependencies', async () => {
    // Build the project
    await runBuild()

    // Read the built assets directory
    const { readdir } = await import('fs/promises')
    const assetFiles = await readdir(assetsPath)

    // CHARACTERIZATION: These chunks MUST exist due to vite.config.ts manualChunks
    const expectedVendorChunks = [
      'vendor-react',     // React & React DOM
      'vendor-editor',    // TipTap editor dependencies
      'vendor-supabase',  // Supabase client
      'vendor-router',    // React Router
      'vendor-utils'      // Zod, DOMPurify, Yjs
    ]

    // Verify each vendor chunk exists in the built assets
    for (const expectedChunk of expectedVendorChunks) {
      const chunkExists = assetFiles.some(file => file.includes(expectedChunk))
      expect(chunkExists, `Vendor chunk '${expectedChunk}' must exist - code splitting is required for bundle optimization. Found files: ${assetFiles.join(', ')}`).toBe(true)
    }

    // REGRESSION GUARD: Should have multiple JS files (evidence of code splitting)
    const jsFiles = assetFiles.filter(file => file.endsWith('.js'))
    expect(jsFiles.length, `Expected multiple JS chunks due to code splitting, found: ${jsFiles.join(', ')}`).toBeGreaterThan(3)

    // Verify entry chunks are reasonably sized (not bloated with vendor code)
    const indexFile = assetFiles.find(file => file.startsWith('index-') && file.endsWith('.js'))
    if (indexFile) {
      const indexPath = join(assetsPath, indexFile)
      const stats = await stat(indexPath)
      const sizeKB = stats.size / 1024

      // CONTRACT: Entry chunks should be under 200KB (vendor code is split out)
      expect(sizeKB, `Entry chunk ${indexFile} is ${sizeKB.toFixed(1)}KB - must be under 200KB due to code splitting`).toBeLessThan(200)
    }
  }, 30000) // 30s timeout for build

  /**
   * CONTRACT: Build warnings must be controlled via chunkSizeWarningLimit
   *
   * Ensures the optimization includes proper warning thresholds
   */
  it('should respect chunk size warning limits from configuration', async () => {
    const { readdir } = await import('fs/promises')
    const assetFiles = await readdir(assetsPath)
    const jsFiles = assetFiles.filter(file => file.endsWith('.js'))

    // Check that no individual chunk exceeds reasonable limits
    for (const jsFile of jsFiles) {
      const chunkPath = join(assetsPath, jsFile)
      const stats = await stat(chunkPath)
      const sizeKB = stats.size / 1024

      // Based on vite.config.ts chunkSizeWarningLimit: 500
      expect(sizeKB, `Chunk ${jsFile} is ${sizeKB.toFixed(1)}KB - should not exceed warning limit`).toBeLessThan(500)
    }
  })

  /**
   * CHARACTERIZATION: Total bundle size should be reasonable
   *
   * This guards against bundle bloat and ensures optimization is working
   */
  it('should maintain reasonable total bundle size', async () => {
    const distPath = join(process.cwd(), 'dist', 'assets')

    // Get all asset files
    const { readdir } = await import('fs/promises')
    const files = await readdir(distPath)

    let totalSize = 0
    for (const file of files) {
      const filePath = join(distPath, file)
      const stats = await stat(filePath)
      totalSize += stats.size
    }

    const totalSizeMB = totalSize / (1024 * 1024)

    // CONTRACT: Total bundle should be under 2MB (optimization working)
    expect(totalSizeMB, `Total bundle size is ${totalSizeMB.toFixed(2)}MB - optimization must keep it under 2MB`).toBeLessThan(2)
  })
})

/**
 * Helper: Run vite build and wait for completion
 */
async function runBuild(): Promise<void> {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'pipe',
      cwd: process.cwd()
    })

    buildProcess.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Build failed with code ${code}`))
      }
    })

    buildProcess.on('error', reject)
  })
}