import React from 'react';

/**
 * Actions Panel Component
 * Buttons to trigger Rovo actions (Jira task, PR comment)
 */
function ActionsPanel({ onCreateJiraTask, onPostPRComment, disabled }) {
  return (
    <div className="actions-panel">
      <button
        className="btn btn-primary action-btn"
        onClick={onCreateJiraTask}
        disabled={disabled}
        aria-label="Create Jira task for this risk analysis"
      >
        <span className="btn-icon" aria-hidden="true">📋</span>
        Create Jira Task
      </button>

      <button
        className="btn btn-secondary action-btn"
        onClick={onPostPRComment}
        disabled={disabled}
        aria-label="Post risk analysis as PR comment"
      >
        <span className="btn-icon" aria-hidden="true">💬</span>
        Post PR Comment
      </button>
    </div>
  );
}

export default ActionsPanel;
