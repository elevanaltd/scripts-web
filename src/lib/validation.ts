/**
 * Security Input Validation Schemas
 *
 * Comprehensive validation for all user inputs using Zod
 * Prevents injection attacks, validates data formats, and enforces business rules
 *
 * Critical-Engineer: consulted for Security vulnerability assessment
 */

import { z } from 'zod';
import DOMPurify from 'dompurify';

// ============================================
// ID VALIDATION SCHEMAS
// ============================================

/**
 * UUID v4 validation schema for Supabase-generated IDs
 * Protects against SQL injection and ensures proper ID format
 */
const uuidSchema = z.string()
  .uuid('Must be a valid UUID')
  .min(1, 'ID cannot be empty');

/**
 * SmartSuite ID validation schema
 * SmartSuite uses 24-character hex strings (not UUIDs)
 * Example: 68aa9add9bedb640d0a3bc0c
 */
const smartSuiteIdSchema = z.string()
  .regex(/^[a-f0-9]{24}$/, 'Must be a valid SmartSuite ID (24-character hex string)')
  .min(1, 'ID cannot be empty');

// SmartSuite tables use their own ID format
export const projectIdSchema = smartSuiteIdSchema;
export const videoIdSchema = smartSuiteIdSchema;

// Scripts are created by us in Supabase, so they use UUIDs
export const scriptIdSchema = uuidSchema;

// ============================================
// CONTENT VALIDATION SCHEMAS
// ============================================

/**
 * Script content validation with XSS protection
 * Sanitizes HTML and enforces reasonable length limits
 */
export const scriptContentSchema = z.string()
  .min(1, 'Script content cannot be empty')
  .max(50000, 'Script content too long (max 50KB)')
  .refine(
    (content) => {
      // First check: basic HTML structure validation
      if (content.includes('<script')) {
        return false;
      }
      if (content.includes('javascript:')) {
        return false;
      }
      if (content.includes('onerror=') || content.includes('onload=') || content.includes('onclick=')) {
        return false;
      }
      return true;
    },
    {
      message: 'Content contains potentially dangerous HTML elements or attributes'
    }
  )
  .transform((content) => {
    // Sanitize the content using DOMPurify
    // Note: In a real server environment, you'd need jsdom for DOMPurify
    // For client-side validation, this works directly
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });
    }
    return content; // Server-side sanitization would happen in API layer
  });

/**
 * Component data validation schema
 * Validates individual script components with content sanitization
 */
export const componentDataSchema = z.object({
  number: z.number()
    .int('Component number must be an integer')
    .positive('Component number must be positive')
    .max(1000, 'Component number too high (max 1000)'),

  content: z.string()
    .min(1, 'Component content cannot be empty')
    .max(10000, 'Component content too long (max 10KB)')
    .refine(
      (content) => {
        // Reject dangerous HTML in component content
        const dangerous = ['<script', 'javascript:', 'onerror=', 'onload=', 'onclick=', '<iframe', '<object'];
        return !dangerous.some(pattern => content.toLowerCase().includes(pattern));
      },
      {
        message: 'Component content contains dangerous HTML'
      }
    ),

  wordCount: z.number()
    .int('Word count must be an integer')
    .min(0, 'Word count cannot be negative')
    .max(10000, 'Word count too high (max 10000)'),

  hash: z.string()
    .min(1, 'Hash cannot be empty')
    .max(64, 'Hash too long (max 64 characters)')
    .regex(/^[a-zA-Z0-9]+$/, 'Hash must contain only alphanumeric characters')
});

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate project ID with comprehensive error handling
 */
export function validateProjectId(projectId: unknown): string {
  try {
    return projectIdSchema.parse(projectId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid project ID: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw new ValidationError('Invalid project ID format');
  }
}

/**
 * Validate video ID with comprehensive error handling
 */
export function validateVideoId(videoId: unknown): string {
  try {
    return videoIdSchema.parse(videoId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid video ID: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw new ValidationError('Invalid video ID format');
  }
}

/**
 * Validate script ID with comprehensive error handling
 */
export function validateScriptId(scriptId: unknown): string {
  try {
    return scriptIdSchema.parse(scriptId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid script ID: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw new ValidationError('Invalid script ID format');
  }
}

/**
 * Validate and sanitize script content
 */
export function validateScriptContent(content: unknown): string {
  try {
    return scriptContentSchema.parse(content);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid script content: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw new ValidationError('Invalid script content format');
  }
}

/**
 * Validate component data structure
 */
export function validateComponentData(component: unknown): ComponentData {
  try {
    return componentDataSchema.parse(component);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid component data: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw new ValidationError('Invalid component data format');
  }
}

/**
 * Validate array of components with batch processing
 */
export function validateComponentArray(components: unknown[]): ComponentData[] {
  if (!Array.isArray(components)) {
    throw new ValidationError('Components must be an array');
  }

  if (components.length > 1000) {
    throw new ValidationError('Too many components (max 1000)');
  }

  return components.map((component, index) => {
    try {
      return validateComponentData(component);
    } catch (error) {
      throw new ValidationError(`Component ${index + 1}: ${error instanceof ValidationError ? error.message : 'Invalid format'}`);
    }
  });
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ComponentData {
  number: number;
  content: string;
  wordCount: number;
  hash: string;
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================
// SERVER-SIDE SANITIZATION UTILITIES
// ============================================

/**
 * Server-side HTML sanitization using DOMPurify + jsdom
 * This function should be used in API endpoints/Edge Functions
 *
 * Note: This requires jsdom in a server environment:
 * npm install jsdom @types/jsdom
 */
export function sanitizeHTMLServerSide(dirtyHTML: string): string {
  // This would be implemented in server-side code (Supabase Edge Functions)
  // const { JSDOM } = require('jsdom');
  // const createDOMPurify = require('dompurify');
  // const window = new JSDOM('').window;
  // const DOMPurify = createDOMPurify(window);

  // For now, return the content as-is
  // Real implementation would sanitize server-side
  console.warn('Server-side sanitization not implemented - implement in API layer');
  return dirtyHTML;
}

// ============================================
// VALIDATION MIDDLEWARE HELPERS
// ============================================

/**
 * Express-style validation middleware factory
 */
export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>,
  field: string = 'body'
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: any, res: any, next: any) => {
    try {
      req[field] = schema.parse(req[field]);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.issues
        });
        return;
      }
      res.status(500).json({
        error: 'Internal validation error'
      });
    }
  };
}