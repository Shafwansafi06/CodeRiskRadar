import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './styles.css';
import AIRemediation from './components/AIRemediation';

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
    if (score < 0.3) return 'low';
    if (score < 0.6) return 'medium';
    return 'high';
  };

  const getRiskColor = (score) => {
    if (score < 0.3) return '#10b981';
    if (score < 0.6) return '#f59e0b';
    return '#ef4444';
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    return num.toLocaleString();
  };

  // Calculate logical risk factors
  const calculateRiskFactors = () => {
    if (!data || !data.stats) return [];

    const { additions = 0, deletions = 0, changedFiles: changed_files = 0 } = data.stats;
    const totalChanges = additions + deletions;

    const factors = [];

    // 1. Change Size Risk (0-100%)
    const sizeRisk = Math.min((totalChanges / 500) * 100, 100);
    factors.push({
      name: 'Code Size',
      value: Math.round(sizeRisk),
      description: totalChanges < 100 ? 'Small change' : totalChanges < 300 ? 'Medium change' : 'Large change',
      color: sizeRisk < 30 ? '#10b981' : sizeRisk < 60 ? '#f59e0b' : '#ef4444'
    });

    // 2. File Complexity Risk (0-100%)
    const fileRisk = Math.min((changed_files / 20) * 100, 100);
    factors.push({
      name: 'File Complexity',
      value: Math.round(fileRisk),
      description: changed_files < 5 ? 'Focused change' : changed_files < 10 ? 'Moderate scope' : 'Wide scope',
      color: fileRisk < 30 ? '#10b981' : fileRisk < 60 ? '#f59e0b' : '#ef4444'
    });

    // 3. Code Churn Risk (0-100%)
    const churnRisk = deletions > 0 ? Math.min((deletions / additions) * 100, 100) : 0;
    factors.push({
      name: 'Code Churn',
      value: Math.round(churnRisk),
      description: churnRisk < 30 ? 'Mostly additions' : churnRisk < 60 ? 'Balanced' : 'Heavy refactoring',
      color: churnRisk < 30 ? '#10b981' : churnRisk < 60 ? '#f59e0b' : '#ef4444'
    });

    // 4. Documentation Quality (0-100%, inverse)
    const { title = '', body = '' } = data;
    const docScore = Math.min(((title.length + body.length) / 100) * 100, 100);
    const docRisk = 100 - docScore;
    factors.push({
      name: 'Documentation',
      value: Math.round(docRisk),
      description: docRisk < 30 ? 'Well documented' : docRisk < 60 ? 'Needs detail' : 'Poorly documented',
      color: docRisk < 30 ? '#10b981' : docRisk < 60 ? '#f59e0b' : '#ef4444'
    });

    return factors;
  };

  if (loading) {
    return (
      <div className="risk-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Analyzing PR with AI...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="risk-container">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Analysis Failed</h3>
          <p>{error}</p>
          <button onClick={loadData} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="risk-container">
        <div className="error-state">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const riskScore = data.risk_score || 0;
  const riskPercent = Math.round(riskScore * 100);
  const riskLevel = getRiskLevel(riskScore);
  const riskColor = getRiskColor(riskScore);
  const riskFactors = calculateRiskFactors();

  const additions = data.stats?.additions || 0;
  const deletions = data.stats?.deletions || 0;
  const files = data.stats?.changedFiles || 0;

  return (
    <div className="risk-container">
      {/* Header */}
      <div className="risk-header">
        <div className="header-content">
          <div className="logo-section">
            <span className="logo-icon">⚡</span>
            <div>
              <h1>Risk Radar</h1>
              <p className="subtitle">AI-Powered Code Analysis</p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Score Circle */}
      <div className="risk-score-section">
        <div className="score-circle" style={{ '--score-color': riskColor }}>
          <svg className="progress-ring" width="160" height="160">
            <circle
              className="progress-ring-bg"
              cx="80"
              cy="80"
              r="68"
            />
            <circle
              className="progress-ring-fill"
              cx="80"
              cy="80"
              r="68"
              style={{
                strokeDasharray: `${riskPercent * 4.27} 427`,
                stroke: riskColor
              }}
            />
          </svg>
          <div className="score-content">
            <div className="score-number" style={{ color: riskColor }}>{riskPercent}</div>
            <div className="score-label">{riskLevel.toUpperCase()}</div>
          </div>
        </div>
        <div className={`risk-badge badge-${riskLevel}`}>
          {riskLevel === 'low' && '✓ Safe to Merge'}
          {riskLevel === 'medium' && '⚡ Review Required'}
          {riskLevel === 'high' && '⚠ High Risk'}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card stat-additions">
          <div className="stat-value">+{formatNumber(additions)}</div>
          <div className="stat-label">Additions</div>
        </div>
        <div className="stat-card stat-deletions">
          <div className="stat-value">-{formatNumber(deletions)}</div>
          <div className="stat-label">Deletions</div>
        </div>
        <div className="stat-card stat-files">
          <div className="stat-value">{formatNumber(files)}</div>
          <div className="stat-label">Files</div>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="section-card">
        <h3 className="section-title">
          <span className="title-icon">📊</span>
          Risk Factors
        </h3>
        <div className="factors-list">
          {riskFactors.map((factor, index) => (
            <div key={index} className="factor-item">
              <div className="factor-header">
                <span className="factor-name">{factor.name}</span>
                <span className="factor-value" style={{ color: factor.color }}>
                  {factor.value}%
                </span>
              </div>
              <div className="factor-bar">
                <div
                  className="factor-fill"
                  style={{
                    width: `${factor.value}%`,
                    background: `linear-gradient(90deg, ${factor.color}, ${factor.color}dd)`
                  }}
                />
              </div>
              <p className="factor-description">{factor.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI-Powered Remediation - Always show */}
      {riskScore >= 0 && (
        <div className="section-card">
          <h3 className="section-title">
            <span className="title-icon">🏎️</span>
            AI Pit Crew Recommendations
          </h3>
          <AIRemediation
            prData={{
              prId: data.prId,
              title: data.prTitle,
              filesChanged: data.filesChanged,
              additions: data.stats?.additions,
              deletions: data.stats?.deletions
            }}
            riskAnalysis={{
              risk_score: riskPercent,
              risk_factors: data.risk_factors || []
            }}
          />
        </div>
      )}

      {/* Similar PRs */}
      {data.ml_analysis?.similar_prs && data.ml_analysis.similar_prs.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">
            <span className="title-icon">🔍</span>
            Similar PRs
          </h3>
          <div className="similar-prs-list">
            {data.ml_analysis.similar_prs.map((pr, index) => (
              <div key={index} className="similar-pr-card">
                <div className="pr-header">
                  <span className="pr-title">{pr.title}</span>
                  <span className="similarity-badge">
                    {Math.round((pr.similarity || 0) * 100)}% match
                  </span>
                </div>
                <div className="pr-meta">
                  {pr.organization && (
                    <span className="pr-org">🏢 {pr.organization}</span>
                  )}
                  <span className="pr-changes">
                    +{pr.additions || 0} -{pr.deletions || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <span className="model-info">
          {data.ml_analysis?.ml_model || 'baseline'} •
          {data.ml_analysis?.data_source || 'statistical'}
        </span>
      </div>
    </div>
  );
}

export default App;
