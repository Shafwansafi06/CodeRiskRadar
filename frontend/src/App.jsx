import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './styles.css';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(true);

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
      <div className={`risk-radar-app ${darkMode ? 'dark' : ''}`}>
        <div className="rr-content">
          <div className="rr-loading">
            <div>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`risk-radar-app ${darkMode ? 'dark' : ''}`}>
        <div className="rr-content">
          <div className="rr-section">
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const riskLevel = getRiskLevel(data.risk_score);
  const riskPercent = Math.round(data.risk_score * 100);

  return (
    <div className={`risk-radar-app ${darkMode ? 'dark' : ''}`}>
      <div className="rr-header">
        <div>
          <div className="rr-logo">⚡</div>
        </div>
        <div>
          <h1>Risk Radar</h1>
          <p>AI-Powered Analysis</p>
        </div>
        <button onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="rr-content">
        {/* Risk Score */}
        <div className="rr-section">
          <div className="rr-risk-circle">
            <div className="rr-risk-score">{riskPercent}</div>
            <div className={`rr-risk-badge ${riskLevel}`}>
              {getRiskLabel(data.risk_score)}
            </div>
            {data.dataSource && (
              <div className="rr-badge success">
                {data.dataSource}
              </div>
            )}
            {data.version && (
              <div className="rr-badge info">
                {data.version}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="rr-stats">
          <div className="rr-stat">
            <div className="rr-stat-value additions">+{data.stats?.additions || 0}</div>
            <div className="rr-stat-label">Additions</div>
          </div>
          <div className="rr-stat">
            <div className="rr-stat-value deletions">-{data.stats?.deletions || 0}</div>
            <div className="rr-stat-label">Deletions</div>
          </div>
          <div className="rr-stat">
            <div className="rr-stat-value files">{data.stats?.changedFiles || 0}</div>
            <div className="rr-stat-label">Files</div>
          </div>
        </div>

        {/* Risk Factors */}
        <div className="rr-section">
          <h3>Risk Factors</h3>
          {data.factors && Object.entries(data.factors).map(([key, value]) => {
            const level = getRiskLevel(value);
            const percent = Math.round(value * 100);
            return (
              <div key={key} className="rr-factor">
                <div className="rr-factor-header">
                  <span className="rr-factor-label">{key}</span>
                  <span className="rr-factor-value">{percent}%</span>
                </div>
                <div className="rr-progress">
                  <div 
                    className={`rr-progress-bar ${level}`}
                    data-percent={Math.round(percent / 10) * 10}
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Files Changed */}
        {data.filesChanged && data.filesChanged.length > 0 && (
          <div className="rr-section">
            <h3>Files Changed ({data.filesChanged.length})</h3>
            {data.filesChanged.slice(0, 5).map((file, idx) => {
              const fileRiskLevel = getRiskLevel(file.risk_score || 0);
              return (
                <div key={idx} className="rr-file">
                  <div className="rr-file-header">
                    <span className="rr-file-name">{file.filename}</span>
                    <span className={`rr-file-risk ${fileRiskLevel}`}>
                      {Math.round((file.risk_score || 0) * 100)}%
                    </span>
                  </div>
                  <div>
                    +{file.additions || 0} -{file.deletions || 0} ({file.changes || 0} changes)
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Suggestions */}
        {data.suggestions && data.suggestions.length > 0 && (
          <div className="rr-section">
            <h3>AI Suggestions ({data.suggestions.length})</h3>
            {data.suggestions.slice(0, 3).map((suggestion, idx) => (
              <div key={idx} className="rr-suggestion">
                <div className="rr-suggestion-title">{suggestion.title}</div>
                <div className="rr-suggestion-desc">{suggestion.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
