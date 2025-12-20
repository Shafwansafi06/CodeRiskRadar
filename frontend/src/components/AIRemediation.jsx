import React, { useState } from 'react';
import { invoke } from '@forge/bridge';

function AIRemediation({ prData, riskAnalysis }) {
    const [suggestions, setSuggestions] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const generateSuggestions = async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await invoke('getAIRemediation', {
                prData,
                riskAnalysis
            });

            if (result.success) {
                setSuggestions(result.suggestions);
            } else {
                setError(result.error || 'Failed to generate suggestions');
                setSuggestions(result.suggestions || []); // Show fallback if available
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!suggestions && !loading) {
        return (
            <div className="ai-remediation-cta">
                <div className="cta-content">
                    <div className="cta-icon">✨</div>
                    <h4>Get AI-Powered Fix Recommendations</h4>
                    <p>Let Gemini AI analyze this PR and suggest specific actions to reduce risk</p>
                    <button
                        onClick={generateSuggestions}
                        className="btn-primary btn-ai"
                    >
                        <span className="btn-icon">✨</span>
                        Generate Recommendations
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="ai-remediation-loading">
                <div className="spinner">🏎️</div>
                <p>Gemini AI analyzing your PR...</p>
                <small>This usually takes 2-3 seconds</small>
            </div>
        );
    }

    return (
        <div className="ai-remediation-results">
            <div className="results-header">
                <span className="header-icon">✨</span>
                <h4>AI Pit Crew Recommendations</h4>
                <span className="ai-badge">Powered by Gemini 2.0</span>
            </div>

            {error && (
                <div className="ai-warning">
                    ⚠️ Using fallback suggestions (AI service unavailable)
                </div>
            )}

            <div className="suggestions-list">
                {suggestions.map((suggestion, idx) => (
                    <div key={idx} className="suggestion-card">
                        <div className="suggestion-number">
                            <span>{suggestion.step}</span>
                        </div>

                        <div className="suggestion-content">
                            <h5 className="suggestion-action">{suggestion.action}</h5>

                            <div className="suggestion-meta">
                                <div className="meta-item">
                                    <span className="meta-icon">⏱️</span>
                                    <span>{suggestion.timeEstimate}</span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-icon">🎯</span>
                                    <span>Risk Reduction</span>
                                </div>
                            </div>

                            <p className="suggestion-reasoning">
                                <strong>Why:</strong> {suggestion.reasoning}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="ai-footer">
                <button
                    onClick={generateSuggestions}
                    className="btn-secondary btn-sm"
                >
                    🔄 Regenerate Suggestions
                </button>
            </div>
        </div>
    );
}

export default AIRemediation;
