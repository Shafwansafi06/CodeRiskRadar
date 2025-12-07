import React, { useEffect, useRef } from 'react';

/**
 * Confirmation Modal Component
 * Shows action preview and requires explicit confirmation
 */
function ConfirmationModal({ isOpen, action, preview, onConfirm, onCancel }) {
  const modalRef = useRef(null);
  const confirmButtonRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        // Close if clicking backdrop
        if (e.target.classList.contains('modal-overlay')) {
          onCancel();
        }
      }}
    >
      <div className="modal-container" ref={modalRef}>
        {/* Header */}
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            <span className="modal-icon" aria-hidden="true">⚠️</span>
            Confirm Action
          </h2>
          <button
            className="modal-close-btn"
            onClick={onCancel}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <p className="modal-action-name">
            <strong>Action:</strong> {action}
          </p>

          {preview && (
            <div className="modal-preview">
              <h3 className="preview-title">Preview:</h3>
              <div className="preview-content">
                <pre className="preview-text">{preview}</pre>
              </div>
            </div>
          )}

          <div className="modal-warning">
            <span className="warning-icon" aria-hidden="true">ℹ️</span>
            <span>This action will make changes. Please review carefully before confirming.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            className="btn btn-primary"
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;
