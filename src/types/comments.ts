// Comments Types - ADR-003 Implementation
// Critical-Engineer: consulted for schema and security validation
// Implements Google Docs-style commenting system with corrected schema

import type { Database } from './database.types';

// Database table types
export type CommentRow = Database['public']['Tables']['comments']['Row'];
export type CommentInsert = Database['public']['Tables']['comments']['Insert'];
export type CommentUpdate = Database['public']['Tables']['comments']['Update'];

// Application-level comment interfaces
export interface Comment {
  id: string;
  scriptId: string;
  userId: string; // NOT NULL in database - must be required
  content: string;
  startPosition: number;
  endPosition: number;
  highlightedText?: string; // Stored text for position recovery
  parentCommentId?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Comment with user profile information for display
export interface CommentWithUser extends Comment {
  user?: {
    id: string;
    email: string;
    displayName?: string | null;
    role?: string | null;
  } | null;
  resolvedByUser?: {
    id: string;
    email: string;
    displayName?: string | null;
  } | null;
}

// Threaded comment structure for UI
export interface CommentThread {
  id: string;
  parentComment: CommentWithUser;
  replies: CommentWithUser[];
  isResolved: boolean;
  replyCount: number;
}

// Comment anchor for TipTap integration
export interface CommentAnchor {
  id: string;
  startPos: number;
  endPos: number;
  resolved: boolean;
  hasReplies: boolean;
}

// Comment creation payload
export interface CreateCommentData {
  scriptId: string;
  content: string;
  startPosition: number;
  endPosition: number;
  highlightedText?: string; // Text content for position recovery
  parentCommentId?: string | null;
}

// Comment resolution payload
export interface ResolveCommentData {
  resolvedAt: string;
  resolvedBy: string;
}

// Comment filter options
export interface CommentFilters {
  resolved?: boolean | null; // null = all, true = resolved only, false = unresolved only
  userId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Comment sort options
export type CommentSortField = 'created_at' | 'start_position' | 'content';
export type CommentSortDirection = 'asc' | 'desc';

export interface CommentSort {
  field: CommentSortField;
  direction: CommentSortDirection;
}

// Real-time comment events
export type CommentEventType = 'comment.created' | 'comment.updated' | 'comment.resolved' | 'comment.deleted';

export interface CommentEvent {
  type: CommentEventType;
  comment: Comment;
  scriptId: string;
  userId: string;
  timestamp: string;
}

// Error types for comment operations
export interface CommentError {
  code: 'INVALID_POSITION' | 'PERMISSION_DENIED' | 'COMMENT_NOT_FOUND' | 'SCRIPT_NOT_FOUND' | 'NETWORK_ERROR' | 'VALIDATION_ERROR' | 'DATABASE_ERROR';
  message: string;
  details?: unknown; // Allow unknown type for database error details
}

// Comment validation rules
export interface CommentValidation {
  minContentLength: number;
  maxContentLength: number;
  minPosition: number;
  maxThreadDepth: number;
}

export const COMMENT_VALIDATION: CommentValidation = {
  minContentLength: 1,
  maxContentLength: 10000,
  minPosition: 0,
  maxThreadDepth: 5, // Prevent infinite nesting
};

// Comment UI state
export interface CommentUIState {
  selectedCommentId?: string | null;
  expandedThreads: Set<string>;
  activeFilters: CommentFilters;
  sortOptions: CommentSort;
  isCreating: boolean;
  isLoading: boolean;
}

// Position transformation for text changes
export interface PositionTransform {
  offset: number; // Character offset from beginning of document
  length: number; // Length of change (positive for insertion, negative for deletion)
}

export interface TransformCommentPositions {
  (comments: Comment[], transform: PositionTransform): Comment[];
}

// Position recovery types for hybrid content-based anchoring
export type RecoveryStatus = 'relocated' | 'orphaned' | 'uncertain' | 'fallback';
export type MatchQuality = 'exact' | 'case-insensitive' | 'fuzzy' | 'poor' | 'none';

export interface CommentRecoveryResult {
  status: RecoveryStatus;
  newStartPosition: number;
  newEndPosition: number;
  matchQuality: MatchQuality;
  message: string;
}

// Extended comment with recovery status for UI display
export interface CommentWithRecovery extends CommentWithUser {
  recovery?: CommentRecoveryResult;
}