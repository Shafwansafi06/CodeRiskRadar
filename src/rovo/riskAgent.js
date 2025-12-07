/**
 * Risk Analyst Rovo Agent Adapter
 * 
 * This module provides an adapter for the RiskAnalyst Rovo agent,
 * handling prompt construction, API calls, and response parsing.
 */

const { invoke } = require('@forge/api');

/**
 * Example Input JSON:
 * {
 *   "risk_score": 0.85,
 *   "top_features": [
 *     { "name": "file_size_change", "importance": 0.45 },
 *     { "name": "complexity_increase", "importance": 0.32 },
 *     { "name": "security_keywords", "importance": 0.23 }
 *   ],
 *   "diff_snippet": "+const password = req.body.password;\n+db.query(`SELECT * FROM users WHERE name='${username}'`);",
 *   "file_path": "src/auth/login.js",
 *   "author": "john.doe",
 *   "pr_number": "123"
 * }
 * 
 * Example Output JSON:
 * {
 *   "explanation": "This change introduces a critical SQL injection vulnerability by directly interpolating user input into a database query. Additionally, the password is stored in plain text without hashing.",
 *   "risk_level": "critical",
 *   "actions": [
 *     {
 *       "type": "security",
 *       "priority": "high",
 *       "description": "Use parameterized queries to prevent SQL injection",
 *       "evidence_lines": ["db.query(`SELECT * FROM users WHERE name='${username}'`)"],
 *       "effort_estimate": "30 minutes",
 *       "confidence": 0.95
 *     },
 *     {
 *       "type": "security",
 *       "priority": "high",
 *       "description": "Hash password before storage using bcrypt or similar",
 *       "evidence_lines": ["const password = req.body.password"],
 *       "effort_estimate": "1 hour",
 *       "confidence": 0.90
 *     }
 *   ]
 * }
 */

class RiskAnalystAgent {
  constructor(config = {}) {
    this.agentKey = config.agentKey || 'risk-analyst-agent';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 2;
  }

  /**
   * Format top features for the prompt
   */
  formatTopFeatures(features) {
    if (!Array.isArray(features)) return 'No features provided';
    
    return features
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 10)
      .map((feat, idx) => 
        `${idx + 1}. ${feat.name}: ${(feat.importance * 100).toFixed(1)}% importance`
      )
      .join('\n');
  }

  /**
   * Sanitize diff snippet to prevent prompt injection
   */
  sanitizeDiff(diff) {
    if (!diff) return 'No diff provided';
    
    // Limit length
    const maxLength = 2000;
    let sanitized = String(diff).substring(0, maxLength);
    
    // Remove potential prompt injection patterns
    sanitized = sanitized.replace(/```/g, '\\`\\`\\`');
    sanitized = sanitized.replace(/{{/g, '\\{\\{');
    
    if (diff.length > maxLength) {
      sanitized += '\n... (truncated)';
    }
    
    return sanitized;
  }

  /**
   * Build the user prompt with variables
   */
  buildUserPrompt(input) {
    const {
      risk_score,
      top_features,
      diff_snippet,
      file_path,
      author,
      pr_number
    } = input;

    return {
      risk_score: risk_score?.toFixed(3) || 'N/A',
      top_features: this.formatTopFeatures(top_features),
      diff_snippet: this.sanitizeDiff(diff_snippet),
      file_path: file_path || 'Unknown',
      author: author || 'Unknown',
      pr_number: pr_number || 'N/A'
    };
  }

  /**
   * Validate the agent response
   */
  validateResponse(response) {
    if (!response) {
      throw new Error('Empty response from agent');
    }

    const required = ['explanation', 'risk_level', 'actions'];
    for (const field of required) {
      if (!(field in response)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(response.actions)) {
      throw new Error('actions must be an array');
    }

    // Validate risk_level enum
    const validLevels = ['low', 'medium', 'high', 'critical'];
    if (!validLevels.includes(response.risk_level)) {
      console.warn(`Invalid risk_level: ${response.risk_level}, defaulting to 'medium'`);
      response.risk_level = 'medium';
    }

    return response;
  }

  /**
   * Parse the agent response (handles both JSON and text)
   */
  parseResponse(rawResponse) {
    try {
      // If already an object, validate and return
      if (typeof rawResponse === 'object') {
        return this.validateResponse(rawResponse);
      }

      // Try to extract JSON from markdown code blocks
      let jsonStr = rawResponse;
      const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);
      return this.validateResponse(parsed);
    } catch (error) {
      console.error('Failed to parse agent response:', error);
      console.error('Raw response:', rawResponse);
      
      // Return a fallback response
      return {
        explanation: 'Error parsing agent response. Manual review recommended.',
        risk_level: 'medium',
        actions: [{
          type: 'quality',
          priority: 'medium',
          description: 'Manual code review required',
          evidence_lines: [],
          effort_estimate: 'unknown',
          confidence: 0.5
        }],
        error: error.message
      };
    }
  }

  /**
   * Invoke the Risk Analyst agent
   */
  async analyze(input) {
    console.log('RiskAnalystAgent: Starting analysis', {
      file_path: input.file_path,
      risk_score: input.risk_score,
      pr_number: input.pr_number
    });

    const promptVariables = this.buildUserPrompt(input);

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1}/${this.maxRetries + 1}`);
        
        const response = await invoke('rovo.agent.invoke', {
          agentKey: this.agentKey,
          variables: promptVariables,
          timeout: this.timeout
        });

        console.log('Received response from agent');
        const parsed = this.parseResponse(response.content || response);
        
        console.log('RiskAnalystAgent: Analysis complete', {
          risk_level: parsed.risk_level,
          action_count: parsed.actions?.length || 0
        });

        return parsed;
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error('RiskAnalystAgent: All retry attempts failed');
    throw new Error(`Agent invocation failed after ${this.maxRetries + 1} attempts: ${lastError.message}`);
  }

  /**
   * Analyze in batch mode (multiple changes)
   */
  async analyzeBatch(inputs) {
    console.log(`RiskAnalystAgent: Starting batch analysis for ${inputs.length} items`);
    
    const results = [];
    const errors = [];

    // Process in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < inputs.length; i += concurrency) {
      const batch = inputs.slice(i, i + concurrency);
      const promises = batch.map(async (input, idx) => {
        try {
          const result = await this.analyze(input);
          return { success: true, data: result, index: i + idx };
        } catch (error) {
          console.error(`Batch item ${i + idx} failed:`, error);
          return { 
            success: false, 
            error: error.message, 
            index: i + idx,
            input: input
          };
        }
      });

      const batchResults = await Promise.all(promises);
      
      for (const result of batchResults) {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      }
    }

    console.log(`RiskAnalystAgent: Batch complete - ${results.length} succeeded, ${errors.length} failed`);
    
    return { results, errors };
  }

  /**
   * Get a summary suitable for display
   */
  static formatSummary(analysis) {
    if (!analysis) return 'No analysis available';

    const riskEmoji = {
      low: '✅',
      medium: '⚠️',
      high: '🔴',
      critical: '🚨'
    };

    const emoji = riskEmoji[analysis.risk_level] || '❓';
    
    let summary = `${emoji} **Risk Level: ${analysis.risk_level.toUpperCase()}**\n\n`;
    summary += `${analysis.explanation}\n\n`;
    
    if (analysis.actions && analysis.actions.length > 0) {
      summary += `**Recommended Actions (${analysis.actions.length}):**\n`;
      analysis.actions.forEach((action, idx) => {
        const priority = action.priority === 'high' ? '🔴' : 
                        action.priority === 'medium' ? '🟡' : '🟢';
        summary += `${idx + 1}. ${priority} [${action.type}] ${action.description}\n`;
        summary += `   ⏱️ ${action.effort_estimate} | 🎯 ${(action.confidence * 100).toFixed(0)}% confidence\n`;
      });
    }

    return summary;
  }
}

// Export singleton instance and class
const riskAnalystAgent = new RiskAnalystAgent();

module.exports = {
  RiskAnalystAgent,
  riskAnalystAgent,
  analyzeRisk: (input) => riskAnalystAgent.analyze(input),
  analyzeBatch: (inputs) => riskAnalystAgent.analyzeBatch(inputs),
  formatSummary: RiskAnalystAgent.formatSummary
};
