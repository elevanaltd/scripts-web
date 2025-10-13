/**
 * Test Data Factories
 *
 * Provides factory functions for generating mock test data with sensible defaults.
 * Follows the Factory Pattern - each function creates a complete, valid object.
 *
 * Usage:
 * ```tsx
 * import { createMockScript, createMockComment } from './test/factories'
 *
 * // With defaults
 * const script = createMockScript()
 *
 * // With overrides
 * const script = createMockScript({
 *   id: 'custom-id',
 *   status: 'final',
 *   video_id: 'video-123'
 * })
 *
 * // Chain factories for related data
 * const project = createMockProject({ id: 'proj-1' })
 * const video = createMockVideo({ project_id: 'proj-1' })
 * const script = createMockScript({ video_id: video.id })
 * const comment = createMockComment({ script_id: script.id })
 * ```
 */

import { Database } from '../types/database.types'

// Type aliases for database tables
type Project = Database['public']['Tables']['projects']['Row']
type Video = Database['public']['Tables']['videos']['Row']
type Script = Database['public']['Tables']['scripts']['Row']
type ScriptComponent = Database['public']['Tables']['script_components']['Row']
type Comment = Database['public']['Tables']['comments']['Row']
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

// Counter for generating unique IDs
let idCounter = 1
function generateId(prefix: string): string {
  return `${prefix}-${idCounter++}`
}

/**
 * Reset ID counter (useful between test files)
 */
export function resetFactoryIds(): void {
  idCounter = 1
}

/**
 * Creates a mock Project with sensible defaults
 */
export function createMockProject(overrides?: Partial<Project>): Project {
  const id = overrides?.id || generateId('project')
  return {
    id,
    title: `Test Project ${id}`,
    eav_code: `EAV-${id.slice(-3).toUpperCase()}`,
    project_phase: 'active',
    due_date: null,
    final_invoice_sent: null,
    client_filter: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Creates a mock Video with sensible defaults
 */
export function createMockVideo(overrides?: Partial<Video>): Video {
  const id = overrides?.id || generateId('video')
  return {
    id,
    project_id: overrides?.project_id || generateId('project'),
    title: `Test Video ${id}`,
    smartsuite_id: `ss-${id}`,
    video_number: 1,
    status: 'in_progress',
    due_date: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Creates a mock Script with sensible defaults
 */
export function createMockScript(overrides?: Partial<Script>): Script {
  const id = overrides?.id || generateId('script')
  return {
    id,
    video_id: overrides?.video_id || generateId('video'),
    plain_text: 'Test script content',
    yjs_state: null,
    component_count: 0,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Creates a mock ScriptComponent with sensible defaults
 */
export function createMockScriptComponent(overrides?: Partial<ScriptComponent>): ScriptComponent {
  const id = overrides?.id || generateId('component')
  const componentNumber = overrides?.component_number || 1
  return {
    id,
    script_id: overrides?.script_id || generateId('script'),
    component_number: componentNumber,
    content: `Component C${componentNumber} content`,
    word_count: 10,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Creates a mock Comment with sensible defaults
 */
export function createMockComment(overrides?: Partial<Comment>): Comment {
  const id = overrides?.id || generateId('comment')
  return {
    id,
    script_id: overrides?.script_id || generateId('script'),
    user_id: overrides?.user_id || generateId('user'),
    content: 'Test comment content',
    highlighted_text: 'highlighted',
    start_position: 0,
    end_position: 11,
    parent_comment_id: null,
    resolved_at: null,
    resolved_by: null,
    deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Creates a mock UserProfile with sensible defaults
 */
export function createMockUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  const id = overrides?.id || generateId('user')
  const email = overrides?.email || `user-${id}@example.com`
  return {
    id,
    email,
    display_name: overrides?.display_name || `User ${id}`,
    role: overrides?.role || 'client',
    client_filter: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Creates a complete project hierarchy: Project → Video → Script → Components
 */
export function createProjectHierarchy(options?: {
  projectOverrides?: Partial<Project>
  videoOverrides?: Partial<Video>
  scriptOverrides?: Partial<Script>
  componentCount?: number
}) {
  const project = createMockProject(options?.projectOverrides)
  const video = createMockVideo({
    project_id: project.id,
    ...options?.videoOverrides,
  })
  const script = createMockScript({
    video_id: video.id,
    component_count: options?.componentCount || 3,
    ...options?.scriptOverrides,
  })

  const componentCount = options?.componentCount || 3
  const components = Array.from({ length: componentCount }, (_, i) =>
    createMockScriptComponent({
      script_id: script.id,
      component_number: i + 1,
      content: `Component C${i + 1} content for testing`,
    })
  )

  return { project, video, script, components }
}

/**
 * Creates a comment thread: Parent comment → Reply → Reply
 */
export function createCommentThread(options?: {
  scriptId?: string
  userId?: string
  replyCount?: number
}): Comment[] {
  const scriptId = options?.scriptId || generateId('script')
  const userId = options?.userId || generateId('user')
  const replyCount = options?.replyCount || 2

  const parentComment = createMockComment({
    script_id: scriptId,
    user_id: userId,
    content: 'Parent comment',
  })

  const replies = Array.from({ length: replyCount }, (_, i) =>
    createMockComment({
      script_id: scriptId,
      user_id: userId,
      parent_comment_id: parentComment.id,
      content: `Reply ${i + 1}`,
    })
  )

  return [parentComment, ...replies]
}

/**
 * Creates multiple users with different roles
 */
export function createUserSet(): {
  admin: UserProfile
  employee: UserProfile
  client: UserProfile
} {
  return {
    admin: createMockUserProfile({
      id: 'admin-user',
      email: 'admin@eav.app',
      display_name: 'Admin User',
      role: 'admin',
    }),
    employee: createMockUserProfile({
      id: 'employee-user',
      email: 'employee@eav.app',
      display_name: 'Employee User',
      role: 'employee',
    }),
    client: createMockUserProfile({
      id: 'client-user',
      email: 'client@example.com',
      display_name: 'Client User',
      role: 'client',
      client_filter: 'CLIENT-123',
    }),
  }
}

/**
 * Type guard: Check if Video object exists
 */
type Video = Database['public']['Tables']['videos']['Row']

// Re-export for tests
export type {
  Project,
  Video,
  Script,
  ScriptComponent,
  Comment,
  UserProfile,
}
