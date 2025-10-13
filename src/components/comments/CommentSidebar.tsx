/**
 * CommentSidebar.tsx - Google Docs-Style Comments Sidebar
 *
 * STEP 2.2.2-REVISED: Component gutted to <300 LOC
 * Business logic extracted to useCommentSidebar hook (~710 LOC)
 *
 * Implementation of ADR-003 specification:
 * - Fixed right panel (300px width)
 * - Shows comments in document order
 * - Filter controls (All/Open/Resolved)
 * - Comment cards with threading
 * - Comment creation form
 *
 * Architecture: Pure UI consumer of useCommentSidebar hook
 * Complexity: <300 LOC (pure JSX + minimal event delegation)
 */

import React from 'react';
import { useCommentSidebar } from '../../core/state/useCommentSidebar';
import type { CreateCommentData } from '../../types/comments';
import './CommentSidebar.css';

export interface CommentSidebarProps {
  scriptId: string;
  createComment?: {
    startPosition: number;
    endPosition: number;
    selectedText: string;
  } | null;
  onCommentCreated?: (commentData: CreateCommentData) => void;
  onCommentCancelled?: () => void;
  onCommentDeleted?: (commentId: string) => void;
}

export const CommentSidebar: React.FC<CommentSidebarProps> = ({
  scriptId,
  createComment,
  onCommentCreated,
  onCommentCancelled,
  onCommentDeleted
}) => {
  // ========== SINGLE HOOK CONSUMPTION ==========
  // All business logic abstracted to hook - component becomes pure UI
  const {
    threads,
    loading,
    error,
    connectionStatus,
    filterMode,
    setFilterMode,
    commentText,
    setCommentText,
    submitting,
    handleCreateComment,
    handleCancelComment,
    replyingTo,
    replyText,
    setReplyText,
    submittingReply,
    handleReplyClick,
    handleReplySubmit,
    handleCancelReply,
    editing,
    editText,
    setEditText,
    submittingEdit,
    handleEditClick,
    handleEditSubmit,
    handleEditCancel,
    deleteConfirming,
    deleting,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleDeleteClick,
    handleResolveToggle,
    canDeleteComment,
    canEditComment,
    setMutationError,
    showUniversalForm,
    setShowUniversalForm,
    handleCreateUniversalComment,
  } = useCommentSidebar({
    scriptId,
    createComment,
    onCommentCreated,
    onCommentCancelled,
    onCommentDeleted,
  });

  // ========== LOADING STATE ==========

  // ========== EARLY RETURN: LOADING ==========
  if (loading) {
    return (
      <aside className="comments-sidebar" role="complementary" aria-label="Comments Sidebar">
        <div role="status" aria-label="Loading Comments">
          Loading comments...
        </div>
      </aside>
    );
  }

  // ========== RENDER: MAIN UI ==========
  return (
    <aside className="comments-sidebar" role="complementary" aria-label="Comments Sidebar">
      {/* Connection Status Banner */}
      {connectionStatus === 'reconnecting' && (
        <div className="connection-status-banner reconnecting" role="status">
          <span>Reconnecting to live updates...</span>
        </div>
      )}
      {connectionStatus === 'degraded' && (
        <div className="connection-status-banner degraded" role="alert">
          <span>Connection degraded. Some features may be unavailable.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="reconnect-button"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Priority 4: Sticky Header Container - stays visible while comments scroll */}
      <div className="comments-sticky-header">
        {/* Header */}
        <header role="banner" aria-label="Comments Header">
          <h2>Comments</h2>
        </header>

        {/* Inline Error Display for Operations */}
        {error && (
          <div className="inline-error" role="alert">
            <div className="error-content">
              <span className="error-icon-small">⚠️</span>
              <span className="error-message-small">{error}</span>
              <button
                type="button"
                onClick={() => setMutationError(null)}
                className="error-dismiss"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="comment-filters">
          <button
            type="button"
            aria-label="All Comments"
            className={filterMode === 'all' ? 'active' : ''}
            onClick={() => setFilterMode('all')}
          >
            All Comments
          </button>
          <button
            type="button"
            aria-label="Open Comments"
            className={filterMode === 'open' ? 'active' : ''}
            onClick={() => setFilterMode('open')}
          >
            Open Comments
          </button>
          <button
            type="button"
            aria-label="Resolved Comments"
            className={filterMode === 'resolved' ? 'active' : ''}
            onClick={() => setFilterMode('resolved')}
          >
            Resolved Comments
          </button>
        </div>

        {/* Universal Comment Button */}
        <button
          type="button"
          className="universal-comment-button"
          onClick={() => setShowUniversalForm(!showUniversalForm)}
          aria-label="Add Script Comment"
        >
          💬 Comment on Script
        </button>
      </div>

      {/* Universal Comment Form - shown when button clicked AND no text selected */}
      {showUniversalForm && !createComment && (
        <form
          role="form"
          aria-label="Universal Comment"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateUniversalComment();
          }}
        >
          <div className="universal-comment-header">
            <strong>Script-level Comment</strong>
            <span>(Not tied to specific text)</span>
          </div>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment about the script as a whole..."
            aria-label="Universal Comment Text"
            disabled={submitting}
          />
          <div className="form-actions">
            <button
              type="submit"
              disabled={!commentText.trim() || submitting || connectionStatus !== 'connected'}
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUniversalForm(false);
                setCommentText('');
              }}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Comment Creation Form - shown when text is selected */}
      {createComment && (
        <form
          role="form"
          aria-label="New Comment"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateComment();
          }}
        >
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            aria-label="Comment Text"
            disabled={submitting}
          />
          <div className="form-actions">
            <button
              type="submit"
              aria-label="Submit"
              disabled={!commentText.trim() || submitting || connectionStatus !== 'connected'}
            >
              Submit
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={handleCancelComment}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="comments-list">
        {threads.length === 0 ? (
          <div className="empty-state">
            <p>No comments yet.</p>
            <p>Select text to add a comment.</p>
          </div>
        ) : (
          threads.map((thread) => (
            <div key={thread.id} className="comment-thread">
              {/* Parent Comment */}
              <article
                role="article"
                className={`comment-card ${thread.isResolved ? 'comment-resolved' : ''}`}
                data-comment-id={thread.parentComment.id}
                onMouseEnter={() => {
                  // Highlight corresponding text when hovering comment
                  const highlight = document.querySelector(`[data-comment-id="${thread.parentComment.id}"].comment-highlight`);
                  if (highlight) {
                    highlight.classList.add('highlight-hover');
                  }
                }}
                onMouseLeave={() => {
                  // Remove highlight when leaving comment
                  const highlight = document.querySelector(`[data-comment-id="${thread.parentComment.id}"].comment-highlight`);
                  if (highlight) {
                    highlight.classList.remove('highlight-hover');
                  }
                }}
              >
                <div className="comment-header">
                  <div className="comment-number-badge">{thread.commentNumber}</div>
                  <span className="comment-author">{thread.parentComment.user?.displayName || thread.parentComment.user?.email || 'Unknown'}</span>
                  <span className="comment-date">{new Date(thread.parentComment.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Conditional rendering: Edit form or comment content */}
                {editing === thread.parentComment.id ? (
                  <div className="edit-form">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      aria-label="Edit Comment Text"
                      disabled={submittingEdit}
                      className="edit-textarea"
                    />
                    <div className="form-actions">
                      <button
                        type="button"
                        aria-label="Save Edit"
                        onClick={() => handleEditSubmit(thread.parentComment.id)}
                        disabled={!editText.trim() || submittingEdit}
                      >
                        {submittingEdit ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel Edit"
                        onClick={handleEditCancel}
                        disabled={submittingEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="comment-content">{thread.parentComment.content}</div>
                    <div className="comment-actions">
                      <button type="button" aria-label="Reply" onClick={() => handleReplyClick(thread.parentComment.id)}>
                        Reply
                      </button>
                      {thread.isResolved ? (
                        <button type="button" aria-label="Reopen" onClick={() => handleResolveToggle(thread.parentComment.id, true)}>
                          Reopen
                        </button>
                      ) : (
                        <button type="button" aria-label="Resolve" onClick={() => handleResolveToggle(thread.parentComment.id, false)}>
                          Resolve
                        </button>
                      )}
                      {canEditComment(thread.parentComment) && (
                        <button type="button" aria-label="Edit" onClick={() => handleEditClick(thread.parentComment)}>
                          Edit
                        </button>
                      )}
                      {canDeleteComment(thread.parentComment) && (
                        <button type="button" aria-label="Delete" onClick={() => handleDeleteClick(thread.parentComment.id)} className="delete-button">
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </article>

              {/* Reply Form for Parent Comment */}
              {replyingTo === thread.parentComment.id && (
                <form role="form" aria-label="Reply Form" className="reply-form" onSubmit={(e) => { e.preventDefault(); handleReplySubmit(thread.parentComment.id); }}>
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." aria-label="Reply Text" disabled={submittingReply} />
                  <div className="form-actions">
                    <button type="submit" aria-label="Submit Reply" disabled={!replyText.trim() || submittingReply || connectionStatus !== 'connected'}>Submit Reply</button>
                    <button type="button" aria-label="Cancel Reply" onClick={handleCancelReply} disabled={submittingReply}>Cancel Reply</button>
                  </div>
                </form>
              )}

              {/* Replies */}
              {thread.replies.map((reply) => (
                <div key={reply.id}>
                  <article role="article" className="comment-card comment-reply">
                    <div className="comment-header">
                      <span className="comment-author">{reply.user?.displayName || reply.user?.email || 'Unknown'}</span>
                      <span className="comment-date">{new Date(reply.createdAt).toLocaleDateString()}</span>
                    </div>

                    {editing === reply.id ? (
                      <div className="edit-form">
                        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Edit Comment Text" disabled={submittingEdit} className="edit-textarea" />
                        <div className="form-actions">
                          <button type="button" aria-label="Save Edit" onClick={() => handleEditSubmit(reply.id)} disabled={!editText.trim() || submittingEdit}>{submittingEdit ? 'Saving...' : 'Save'}</button>
                          <button type="button" aria-label="Cancel Edit" onClick={handleEditCancel} disabled={submittingEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="comment-content">{reply.content}</div>
                        <div className="comment-actions">
                          <button type="button" aria-label="Reply" onClick={() => handleReplyClick(reply.id)}>Reply</button>
                          {canEditComment(reply) && <button type="button" aria-label="Edit" onClick={() => handleEditClick(reply)}>Edit</button>}
                          {canDeleteComment(reply) && <button type="button" aria-label="Delete" onClick={() => handleDeleteClick(reply.id)} className="delete-button">Delete</button>}
                        </div>
                      </>
                    )}
                  </article>

                  {replyingTo === reply.id && (
                    <form role="form" aria-label="Reply Form" className="reply-form nested-reply" onSubmit={(e) => { e.preventDefault(); handleReplySubmit(thread.parentComment.id); }}>
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." aria-label="Reply Text" disabled={submittingReply} />
                      <div className="form-actions">
                        <button type="submit" aria-label="Submit Reply" disabled={!replyText.trim() || submittingReply || connectionStatus !== 'connected'}>Submit Reply</button>
                        <button type="button" aria-label="Cancel Reply" onClick={handleCancelReply} disabled={submittingReply}>Cancel Reply</button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirming && (
        <div
          role="dialog"
          aria-label="Delete Comment"
          className="delete-dialog-overlay"
          onClick={(e) => e.target === e.currentTarget && handleDeleteCancel()}
        >
          <div className="delete-dialog">
            <h3>Delete Comment</h3>
            <p>Are you sure you want to delete this comment? This action cannot be undone.</p>
            <div className="dialog-actions">
              <button
                type="button"
                aria-label="Confirm Delete"
                onClick={() => handleDeleteConfirm(deleteConfirming)}
                disabled={deleting}
                className="confirm-delete-button"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                aria-label="Cancel Delete"
                onClick={handleDeleteCancel}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};