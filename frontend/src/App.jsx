import React, { useState, useEffect } from 'react';
import * as api from './api';
import Radar from './components/Radar';
import RiskBreakdown from './components/RiskBreakdown';
import SimilarIncidents from './components/SimilarIncidents';
import ActionsPanel from './components/ActionsPanel';
import ConfirmationModal from './components/ConfirmationModal';

/**
 * Main App Component
 * Orchestrates risk analysis UI for PR sidebar
 */
function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalState, setModalState] = useState({
    isOpen: false,
    action: null,
    preview: null,
    onConfirm: null
  });

  // Load initial data
  useEffect(() => {
    loadAnalysis();
  }, []);

  /**
   * Load or refresh risk analysis
   */
  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await api.getRiskAnalysis();
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load risk analysis');
      console.error('Error loading analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle refresh button
   */
  const handleRefresh = async () => {
    try {
      setLoading(true);
      const result = await api.refreshAnalysis();
      setData(result);
    } catch (err) {
      setError('Failed to refresh analysis');
      console.error('Error refreshing:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Jira task creation
   */
  const handleCreateJiraTask = async () => {
    try {
      // Get preview first
      const previewResult = await api.createJiraTask(data.risk_analysis, false);
      
      if (previewResult.requires_confirmation) {
        // Show confirmation modal
        setModalState({
          isOpen: true,
          action: 'Create Jira Task',
          preview: previewResult.preview,
          onConfirm: async () => {
            try {
              const result = await api.createJiraTask(data.risk_analysis, true);
              alert(`✅ Jira task created: ${result.task_key}\n${result.task_url}`);
              setModalState({ isOpen: false, action: null, preview: null, onConfirm: null });
            } catch (err) {
              alert(`❌ Failed to create Jira task: ${err.message}`);
            }
          }
        });
      }
    } catch (err) {
      alert(`❌ Failed to preview Jira task: ${err.message}`);
    }
  };

  /**
   * Handle PR comment posting
   */
  const handlePostPRComment = async () => {
    try {
      // Get preview first
      const previewResult = await api.postPRComment(data.risk_analysis, false);
      
      if (previewResult.requires_confirmation) {
        // Show confirmation modal
        setModalState({
          isOpen: true,
          action: 'Post PR Comment',
          preview: previewResult.preview,
          onConfirm: async () => {
            try {
              const result = await api.postPRComment(data.risk_analysis, true);
              alert(`✅ PR comment posted!\n${result.comment_url}`);
              setModalState({ isOpen: false, action: null, preview: null, onConfirm: null });
            } catch (err) {
              alert(`❌ Failed to post PR comment: ${err.message}`);
            }
          }
        });
      }
    } catch (err) {
      alert(`❌ Failed to preview PR comment: ${err.message}`);
    }
  };

  /**
   * Close modal
   */
  const handleCloseModal = () => {
    setModalState({ isOpen: false, action: null, preview: null, onConfirm: null });
  };

  // Render loading state
  if (loading && !data) {
    return (
      <div className="app-container">
        <div className="loading-state">
          <div className="spinner" aria-label="Loading"></div>
          <p>Analyzing PR for risks...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !data) {
    return (
      <div className="app-container">
        <div className="error-state">
          <div className="error-icon" aria-hidden="true">⚠️</div>
          <h2>Failed to Load Analysis</h2>
          <p>{error}</p>
          <button onClick={loadAnalysis} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Extract risk data
  const riskAnalysis = data?.risk_analysis || {};
  const historicalContext = data?.historical_context || {};
  const metadata = data?.metadata || {};

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="risk-icon" aria-hidden="true">🛡️</span>
            Code Risk Radar
          </h1>
          <button 
            onClick={handleRefresh}
            className="btn btn-icon"
            aria-label="Refresh analysis"
            disabled={loading}
          >
            <span className={loading ? 'spinner-small' : ''}>↻</span>
          </button>
        </div>
        
        {/* Risk Score Banner */}
        <div className={`risk-banner risk-${riskAnalysis.risk_level}`}>
          <span className="risk-score-label">Risk Level:</span>
          <span className="risk-score-value">
            {riskAnalysis.risk_level?.toUpperCase() || 'UNKNOWN'}
          </span>
          <span className="risk-score-numeric">
            {(riskAnalysis.risk_score * 100).toFixed(0)}%
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Explanation */}
        {riskAnalysis.explanation && (
          <section className="explanation-section">
            <h2 className="section-title">Analysis</h2>
            <p className="explanation-text">{riskAnalysis.explanation}</p>
          </section>
        )}

        {/* Radar Chart */}
        {riskAnalysis.top_features && riskAnalysis.top_features.length > 0 && (
          <section className="radar-section">
            <h2 className="section-title">Risk Factors</h2>
            <Radar features={riskAnalysis.top_features} />
          </section>
        )}

        {/* Risk Breakdown */}
        {riskAnalysis.actions && riskAnalysis.actions.length > 0 && (
          <section className="breakdown-section">
            <h2 className="section-title">Recommended Actions</h2>
            <RiskBreakdown actions={riskAnalysis.actions} />
          </section>
        )}

        {/* Similar Incidents */}
        {historicalContext.similar_incidents && historicalContext.similar_incidents.length > 0 && (
          <section className="similar-section">
            <h2 className="section-title">Similar Past Incidents</h2>
            <SimilarIncidents 
              incidents={historicalContext.similar_incidents}
              patterns={historicalContext.patterns}
              recommendations={historicalContext.recommendations}
            />
          </section>
        )}

        {/* Actions Panel */}
        <section className="actions-section">
          <h2 className="section-title">Actions</h2>
          <ActionsPanel 
            onCreateJiraTask={handleCreateJiraTask}
            onPostPRComment={handlePostPRComment}
            disabled={loading}
          />
        </section>

        {/* Metadata Footer */}
        {metadata.file_path && (
          <footer className="metadata-footer">
            <details>
              <summary>Analysis Metadata</summary>
              <dl className="metadata-list">
                {metadata.file_path && (
                  <>
                    <dt>File:</dt>
                    <dd><code>{metadata.file_path}</code></dd>
                  </>
                )}
                {metadata.pr_number && (
                  <>
                    <dt>PR:</dt>
                    <dd>#{metadata.pr_number}</dd>
                  </>
                )}
                {metadata.author && (
                  <>
                    <dt>Author:</dt>
                    <dd>{metadata.author}</dd>
                  </>
                )}
                {metadata.branch && (
                  <>
                    <dt>Branch:</dt>
                    <dd><code>{metadata.branch}</code></dd>
                  </>
                )}
              </dl>
            </details>
          </footer>
        )}
      </main>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modalState.isOpen}
        action={modalState.action}
        preview={modalState.preview}
        onConfirm={modalState.onConfirm}
        onCancel={handleCloseModal}
      />

      {/* Dev Mode Indicator */}
      {!api.isForgeEnvironment && (
        <div className="dev-mode-indicator" role="status">
          🔧 Development Mode - Using Mock Data
        </div>
      )}
    </div>
  );
}

export default App;
