import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './styles.css';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke('getRiskAnalysis', {});
      console.log('📊 Risk Data:', result);
      setData(result);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load risk analysis');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevel = (score) => {
    if (score < 0.4) return 'low';
    if (score < 0.7) return 'medium';
    return 'high';
  };

  const getRiskLabel = (score) => {
    if (score < 0.4) return 'Low Risk';
    if (score < 0.7) return 'Medium Risk';
    return 'High Risk';
  };

  if (loading) {
    return (
      <div className="rr-container">
        <div className="rr-loading">
          <div className="rr-spinner"></div>
          <div className="rr-loading-text">Analyzing PR...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rr-container">
        <div className="rr-error">
          <div className="rr-error-icon">⚠️</div>
          <div className="rr-error-title">Analysis Failed</div>
          <div className="rr-error-message">{error}</div>
        </div>
      </div>
    );
  }

  const riskLevel = getRiskLevel(data.risk_score);
  const riskPercent = Math.round(data.risk_score * 100);

  return (
    <div className="rr-container">
      {/* Compact Header */}
      <div className="rr-header">
        <div>
          <h1>⚡ Risk Radar</h1>
          <p className="rr-header-subtitle">AI-Powered Analysis</p>
        </div>
      </div>

      {/* Risk Score Hero */}
      <div className="rr-risk-score">
        <div className={`rr-risk-value rr-risk-${riskLevel}`}>{riskPercent}</div>
        <div className={`rr-risk-label ${riskLevel}`}>{getRiskLabel(data.risk_score)}</div>
        <div className="rr-risk-source">{data.dataSource || '2.0-fresh-data'}</div>
      </div>

      {/* Stats Grid */}
      <div className="rr-stats-grid">
        <div className="rr-stat-card">
          <div className="rr-stat-value additions">+{data.stats?.additions || 0}</div>
          <div className="rr-stat-label">Additions</div>
        </div>
        <div className="rr-stat-card">
          <div className="rr-stat-value deletions">-{data.stats?.deletions || 0}</div>
          <div className="rr-stat-label">Deletions</div>
        </div>
        <div className="rr-stat-card">
          <div className="rr-stat-value files">{data.stats?.changedFiles || 0}</div>
          <div className="rr-stat-label">Files</div>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="rr-section">
        <h2 className="rr-section-title">Risk Factors</h2>
        {data.factors && Object.entries(data.factors).map(([key, value]) => {
          const level = getRiskLevel(value);
          const percent = Math.round(value * 100);
          return (
            <div key={key} className="rr-factor">
              <div className="rr-factor-header">
                <span className="rr-factor-name">{key}</span>
                <span className="rr-factor-value">{percent}%</span>
              </div>
              <div className="rr-factor-bar">
                <div 
                  className={`rr-factor-fill ${level}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Suggestions - Compact & Actionable */}
      {data.suggestions && data.suggestions.length > 0 && (
        <div className="rr-section">
          <h2 className="rr-section-title">🤖 AI Suggestions ({data.suggestions.length})</h2>
          <div className="rr-suggestions-container">
            {data.suggestions.map((suggestion, idx) => (
              <div key={idx} className={`rr-suggestion-card severity-${suggestion.severity}`}>
                <div className="rr-suggestion-header">
                  <span className="rr-suggestion-category">{suggestion.category}</span>
                  <span className={`rr-suggestion-badge ${suggestion.severity}`}>
                    {suggestion.severity.toUpperCase()}
                  </span>
                </div>
                <div className="rr-suggestion-current">
                  <strong>📍 Current:</strong> {suggestion.current}
                </div>
                <div className="rr-suggestion-text">
                  <strong>💡 Suggestion:</strong> {suggestion.suggestion}
                </div>
                {suggestion.action && (
                  <div className="rr-suggestion-text">
                    <strong>✅ Action:</strong> {suggestion.action}
                  </div>
                )}
                {suggestion.example && (
                  <div className="rr-suggestion-text">
                    <strong>📝 Example:</strong> {suggestion.example}
                  </div>
                )}
                {suggestion.reference && (
                  <div className="rr-suggestion-reference">
                    Reference: {suggestion.reference}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar Incidents */}
      {data.similar_incidents && data.similar_incidents.length > 0 && (
        <div className="rr-section">
          <h2 className="rr-section-title">📊 Similar PRs</h2>
          <div className="rr-incidents-list">
            {data.similar_incidents.slice(0, 3).map((incident, idx) => (
              <div key={idx} className="rr-incident-card">
                <div className="rr-incident-header">
                  <span className="rr-incident-title">{incident.title}</span>
                  <span className="rr-incident-similarity">
                    {Math.round((incident.similarity || 0) * 100)}% match
                  </span>
                </div>
                <div className="rr-incident-meta">
                  <span className="rr-incident-meta-item">+{incident.additions || 0}</span>
                  <span className="rr-incident-meta-item">-{incident.deletions || 0}</span>
                  <span className="rr-incident-meta-item">{incident.organization || 'Team'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
