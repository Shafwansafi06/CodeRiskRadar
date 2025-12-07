import React, { useState } from 'react';

/**
 * Risk Breakdown Component
 * Displays recommended actions with evidence and effort estimates
 */
function RiskBreakdown({ actions }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!actions || actions.length === 0) {
    return (
      <div className="empty-state">
        <p>No recommended actions available.</p>
      </div>
    );
  }

  /**
   * Toggle action expansion
   */
  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  /**
   * Get priority badge class
   */
  const getPriorityClass = (priority) => {
    const priorities = {
      high: 'badge-high',
      medium: 'badge-medium',
      low: 'badge-low',
      critical: 'badge-critical'
    };
    return priorities[priority] || 'badge-default';
  };

  /**
   * Get type badge class
   */
  const getTypeClass = (type) => {
    const types = {
      security: 'badge-security',
      performance: 'badge-performance',
      maintainability: 'badge-maintainability',
      reliability: 'badge-reliability'
    };
    return types[type] || 'badge-default';
  };

  return (
    <div className="risk-breakdown">
      <ul className="actions-list" role="list">
        {actions.map((action, index) => {
          const isExpanded = expandedIndex === index;
          
          return (
            <li key={index} className="action-item">
              <button
                className="action-header"
                onClick={() => toggleExpand(index)}
                aria-expanded={isExpanded}
                aria-controls={`action-details-${index}`}
              >
                <div className="action-header-content">
                  <div className="action-badges">
                    <span className={`badge ${getTypeClass(action.type)}`}>
                      {action.type}
                    </span>
                    <span className={`badge ${getPriorityClass(action.priority)}`}>
                      {action.priority}
                    </span>
                  </div>
                  
                  <p className="action-description">{action.description}</p>
                  
                  <div className="action-meta">
                    {action.effort_estimate && (
                      <span className="meta-item">
                        <span className="meta-icon" aria-hidden="true">⏱️</span>
                        {action.effort_estimate}
                      </span>
                    )}
                    {action.confidence !== undefined && (
                      <span className="meta-item">
                        <span className="meta-icon" aria-hidden="true">📊</span>
                        {(action.confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                </div>
                
                <span 
                  className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
              </button>

              {isExpanded && (
                <div 
                  id={`action-details-${index}`}
                  className="action-details"
                  role="region"
                  aria-label={`Details for ${action.description}`}
                >
                  {action.evidence_lines && action.evidence_lines.length > 0 && (
                    <div className="evidence-section">
                      <h4 className="evidence-title">Evidence:</h4>
                      <ul className="evidence-list">
                        {action.evidence_lines.map((line, lineIndex) => (
                          <li key={lineIndex} className="evidence-item">
                            <code className="evidence-code">{line}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {action.explanation && (
                    <div className="explanation-section">
                      <h4 className="explanation-title">Why this matters:</h4>
                      <p className="explanation-text">{action.explanation}</p>
                    </div>
                  )}

                  {action.resources && action.resources.length > 0 && (
                    <div className="resources-section">
                      <h4 className="resources-title">Resources:</h4>
                      <ul className="resources-list">
                        {action.resources.map((resource, resIndex) => (
                          <li key={resIndex}>
                            <a 
                              href={resource.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="resource-link"
                            >
                              {resource.title}
                              <span className="external-icon" aria-hidden="true">↗</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default RiskBreakdown;
