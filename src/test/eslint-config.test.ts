/**
 * ESLint Configuration Infrastructure Test
 *
 * Purpose: Validates flat config migration (ESLint 9)
 * Pattern: Infrastructure test per TDD exemption (CLAUDE.md:219)
 *
 * TDD Phase Progression:
 * - RED: Test fails (eslint.config.mjs doesn't exist yet)
 * - GREEN: Test passes (after config migration in Phase 2)
 * - REFACTOR: Test updated for auto-fixes (Phase 3)
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ESLint Configuration', () => {
  it('should load flat config successfully', async () => {
    // Import eslint.config.mjs from project root
    const configPath = path.resolve(__dirname, '../../eslint.config.mjs');

    try {
      const config = await import(configPath);

      // Flat config exports default array
      expect(config.default).toBeDefined();
      expect(Array.isArray(config.default)).toBe(true);
    } catch (error) {
      // Expected to fail in RED phase (config doesn't exist yet)
      throw new Error(`Failed to load eslint.config.mjs: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('should have TypeScript parser configured', async () => {
    const configPath = path.resolve(__dirname, '../../eslint.config.mjs');

    try {
      const { default: configs } = await import(configPath);

      // Find config with TypeScript parser
      const tsConfig = configs.find((c: unknown) =>
        typeof c === 'object' && c !== null && 'languageOptions' in c &&
        typeof c.languageOptions === 'object' && c.languageOptions !== null &&
        'parser' in c.languageOptions
      );

      expect(tsConfig).toBeDefined();

      // Verify parser is TypeScript
      if (tsConfig && typeof tsConfig === 'object' && 'languageOptions' in tsConfig) {
        const languageOptions = tsConfig.languageOptions as { parser?: { name?: string } };
        if (languageOptions.parser?.name) {
          expect(languageOptions.parser.name.toLowerCase()).toContain('typescript');
        }
      }
    } catch (error) {
      throw new Error(`TypeScript parser check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('should have React plugins configured', async () => {
    const configPath = path.resolve(__dirname, '../../eslint.config.mjs');

    try {
      const { default: configs } = await import(configPath);

      // Find config with React plugins
      const reactConfig = configs.find((c: unknown) =>
        typeof c === 'object' && c !== null && 'plugins' in c &&
        typeof c.plugins === 'object' && c.plugins !== null &&
        ('react-refresh' in c.plugins || 'react-hooks' in c.plugins)
      );

      expect(reactConfig).toBeDefined();

      // Verify both React plugins present
      if (reactConfig && typeof reactConfig === 'object' && 'plugins' in reactConfig) {
        const plugins = reactConfig.plugins as Record<string, unknown>;
        expect(plugins['react-refresh']).toBeDefined();
        expect(plugins['react-hooks']).toBeDefined();
      }
    } catch (error) {
      throw new Error(`React plugins check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('should have browser environment configured', async () => {
    const configPath = path.resolve(__dirname, '../../eslint.config.mjs');

    try {
      const { default: configs } = await import(configPath);

      // Find config with browser globals
      const browserConfig = configs.find((c: unknown) =>
        typeof c === 'object' && c !== null && 'languageOptions' in c &&
        typeof c.languageOptions === 'object' && c.languageOptions !== null &&
        'globals' in c.languageOptions
      );

      expect(browserConfig).toBeDefined();

      // Verify browser globals present (window, document, etc.)
      if (browserConfig && typeof browserConfig === 'object' && 'languageOptions' in browserConfig) {
        const languageOptions = browserConfig.languageOptions as { globals?: Record<string, unknown> };
        const globals = languageOptions.globals;

        if (globals) {
          // Check for common browser globals
          expect('window' in globals || 'document' in globals).toBe(true);
        }
      }
    } catch (error) {
      throw new Error(`Browser environment check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
});
