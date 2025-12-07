import React, { useState } from 'react';

/**
 * Similar Incidents Component
 * Displays historical incidents from Historian agent
 */
function SimilarIncidents({ incidents, patterns, recommendations }) {
  const [showAllIncidents, setShowAllIncidents] = useState(false);

  if (!incidents || incidents.length === 0) {
    return (
      <div className="empty-state">
        <p>No similar past incidents found.</p>
      </div>
    );
  }

  const displayedIncidents = showAllIncidents ? incidents : incidents.slice(0, 3);

  /**
   * Get severity badge class
   */
  const getSeverityClass = (severity) => {
    const severities = {
      critical: 'badge-critical',
      high: 'badge-high',
      medium: 'badge-medium',
      low: 'badge-low'
    };
    return severities[severity] || 'badge-default';
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  /**
   * Get similarity color
   */
  const getSimilarityColor = (similarity) => {
    if (similarity >= 0.9) return '#d32f2f'; // Very high
    if (similarity >= 0.7) return '#f57c00'; // High
    if (similarity >= 0.5) return '#fbc02d'; // Medium
    return '#7cb342'; // Low
  };

  return (
    <div className="similar-incidents">
      {/* Incidents List */}
      <ul className="incidents-list" role="list">
        {displayedIncidents.map((incident, index) => (
          <li key={incident.id || index} className="incident-item">
            <div className="incident-header">
              <div className="incident-title-row">
                <a 
                  href={incident.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="incident-id"
                >
                  {incident.id}
                  <span className="external-icon" aria-hidden="true">↗</span>
                </a>
                
                <span 
                  className={`badge ${getSeverityClass(incident.severity)}`}
                  aria-label={`Severity: ${incident.severity}`}
                >
                  {incident.severity}
                </span>
              </div>

              <h3 className="incident-summary">{incident.summary}</h3>
            </div>

            <div className="incident-body">
              {/* Similarity Score */}
              <div className="similarity-bar">
                <label className="similarity-label">
                  Similarity: {(incident.similarity * 100).toFixed(0)}%
                </label>
                <div 
                  className="similarity-progress"
                  role="progressbar"
                  aria-valuenow={incident.similarity * 100}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div 
                    className="similarity-fill"
                    style={{
                      width: `${incident.similarity * 100}%`,
                      backgroundColor: getSimilarityColor(incident.similarity)
                    }}
                  ></div>
                </div>
              </div>

              {/* Resolution */}
              {incident.resolution && (
                <div className="incident-resolution">
                  <strong>Resolution:</strong> {incident.resolution}
                </div>
              )}

              {/* Lessons Learned */}
              {incident.lessons && incident.lessons.length > 0 && (
                <div className="incident-lessons">
                  <strong>Lessons Learned:</strong>
                  <ul className="lessons-list">
                    {incident.lessons.map((lesson, lessonIndex) => (
                      <li key={lessonIndex} className="lesson-item">
                        <span className="lesson-bullet" aria-hidden="true">💡</span>
                        {lesson}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Date */}
              {incident.occurred_at && (
                <div className="incident-date">
                  <span className="date-icon" aria-hidden="true">📅</span>
                  {formatDate(incident.occurred_at)}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Show More/Less Button */}
      {incidents.length > 3 && (
        <button
          className="btn btn-secondary show-more-btn"
          onClick={() => setShowAllIncidents(!showAllIncidents)}
          aria-expanded={showAllIncidents}
        >
          {showAllIncidents 
            ? `Show Less` 
            : `Show ${incidents.length - 3} More Incident${incidents.length - 3 > 1 ? 's' : ''}`
          }
        </button>
      )}

      {/* Patterns Section */}
      {patterns && patterns.length > 0 && (
        <div className="patterns-section">
          <h3 className="patterns-title">
            <span className="patterns-icon" aria-hidden="true">🔍</span>
            Identified Patterns
          </h3>
          <ul className="patterns-list">
            {patterns.map((pattern, index) => (
              <li key={index} className="pattern-item">
                {pattern}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations Section */}
      {recommendations && recommendations.length > 0 && (
        <div className="recommendations-section">
          <h3 className="recommendations-title">
            <span className="recommendations-icon" aria-hidden="true">✨</span>
            Recommendations
          </h3>
          <ul className="recommendations-list">
            {recommendations.map((recommendation, index) => (
              <li key={index} className="recommendation-item">
                {recommendation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SimilarIncidents;
