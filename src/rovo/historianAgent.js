/**
 * Historian Rovo Agent Adapter
 * 
 * This module provides an adapter for the Historian Rovo agent,
 * retrieving and analyzing similar past incidents from the embeddings database.
 */

const { invoke } = require('@forge/api');

/**
 * Example Input JSON:
 * {
 *   "embedding_vector": [0.123, -0.456, 0.789, ...],  // 768-dim vector
 *   "code_signature": "sql_query_user_input_concat",
 *   "file_type": "javascript",
 *   "risk_area": "authentication",
 *   "risk_score": 0.85,
 *   "limit": 5
 * }
 * 
 * Example Output JSON:
 * {
 *   "similar_incidents": [
 *     {
 *       "id": "INC-2023-045",
 *       "summary": "SQL injection in user authentication endpoint",
 *       "similarity": 0.92,
 *       "resolution": "Implemented parameterized queries and input validation",
 *       "link": "https://jira.company.com/browse/INC-2023-045",
 *       "lessons": [
 *         "Always use parameterized queries",
 *         "Add input validation layer"
 *       ],
 *       "occurred_at": "2023-08-15T10:30:00Z",
 *       "severity": "critical"
 *     },
 *     {
 *       "id": "INC-2023-112",
 *       "summary": "Authentication bypass via SQL injection",
 *       "similarity": 0.87,
 *       "resolution": "Refactored authentication logic with ORM",
 *       "link": "https://jira.company.com/browse/INC-2023-112",
 *       "lessons": [
 *         "Use ORM instead of raw queries",
 *         "Implement security testing in CI/CD"
 *       ],
 *       "occurred_at": "2023-09-22T14:15:00Z",
 *       "severity": "high"
 *     }
 *   ],
 *   "patterns": [
 *     "SQL injection vulnerabilities often occur in authentication code",
 *     "Direct string concatenation in queries is a common root cause",
 *     "Similar issues tend to reoccur in similar file types"
 *   ],
 *   "recommendations": [
 *     "Implement automated SQL injection testing in CI/CD pipeline",
 *     "Consider using an ORM to reduce direct SQL query writing",
 *     "Add security review checklist for authentication-related changes"
 *   ]
 * }
 */

class HistorianAgent {
  constructor(config = {}) {
    this.agentKey = config.agentKey || 'historian-agent';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 2;
    this.supabaseClient = config.supabaseClient; // Optional: direct Supabase access
  }

  /**
   * Format embedding vector for prompt
   * (truncate for prompt brevity, full vector sent separately if needed)
   */
  formatEmbedding(vector) {
    if (!Array.isArray(vector) || vector.length === 0) {
      return 'No embedding provided';
    }
    
    // Show first 5 and last 5 dimensions with dimension count
    const preview = [
      ...vector.slice(0, 5),
      '...',
      ...vector.slice(-5)
    ];
    
    return `[${preview.join(', ')}] (${vector.length} dimensions)`;
  }

  /**
   * Generate code signature from features
   */
  generateSignature(input) {
    const parts = [];
    
    if (input.risk_area) parts.push(input.risk_area);
    if (input.file_type) parts.push(input.file_type);
    if (input.code_signature) return input.code_signature;
    
    return parts.join('_') || 'unknown';
  }

  /**
   * Build the user prompt with variables
   */
  buildUserPrompt(input) {
    const {
      embedding_vector,
      code_signature,
      file_type,
      risk_area,
      risk_score
    } = input;

    return {
      embedding_vector: this.formatEmbedding(embedding_vector),
      code_signature: code_signature || this.generateSignature(input),
      file_type: file_type || 'unknown',
      risk_area: risk_area || 'general',
      risk_score: risk_score?.toFixed(3) || 'N/A'
    };
  }

  /**
   * Query Supabase directly for similar embeddings
   * (Optional: bypass agent for faster similarity search)
   */
  async querySimilarDirect(embedding, limit = 5) {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not configured for direct queries');
    }

    try {
      const { data, error } = await this.supabaseClient.rpc(
        'match_code_embeddings',
        {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: limit
        }
      );

      if (error) throw error;

      return data.map(item => ({
        id: item.id,
        summary: item.metadata?.summary || 'No summary',
        similarity: item.similarity,
        resolution: item.metadata?.resolution,
        link: item.metadata?.link,
        lessons: item.metadata?.lessons || [],
        occurred_at: item.created_at,
        severity: item.metadata?.severity
      }));
    } catch (error) {
      console.error('Direct Supabase query failed:', error);
      throw error;
    }
  }

  /**
   * Validate the agent response
   */
  validateResponse(response) {
    if (!response) {
      throw new Error('Empty response from agent');
    }

    // Ensure arrays exist
    response.similar_incidents = response.similar_incidents || [];
    response.patterns = response.patterns || [];
    response.recommendations = response.recommendations || [];

    // Validate incident structure
    response.similar_incidents.forEach((incident, idx) => {
      if (!incident.id || !incident.summary) {
        console.warn(`Invalid incident at index ${idx}, skipping`);
        response.similar_incidents.splice(idx, 1);
      }
      
      // Ensure similarity is a number
      if (typeof incident.similarity !== 'number') {
        incident.similarity = 0.5;
      }
    });

    return response;
  }

  /**
   * Parse the agent response
   */
  parseResponse(rawResponse) {
    try {
      if (typeof rawResponse === 'object') {
        return this.validateResponse(rawResponse);
      }

      // Extract JSON from markdown if needed
      let jsonStr = rawResponse;
      const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);
      return this.validateResponse(parsed);
    } catch (error) {
      console.error('Failed to parse historian response:', error);
      
      // Return fallback
      return {
        similar_incidents: [],
        patterns: ['Unable to retrieve historical patterns'],
        recommendations: ['Manual investigation recommended'],
        error: error.message
      };
    }
  }

  /**
   * Query historical incidents
   */
  async query(input) {
    console.log('HistorianAgent: Starting query', {
      file_type: input.file_type,
      risk_area: input.risk_area,
      has_embedding: !!input.embedding_vector
    });

    // Try direct query first if available and embedding provided
    if (this.supabaseClient && input.embedding_vector) {
      try {
        console.log('Attempting direct Supabase query...');
        const directResults = await this.querySimilarDirect(
          input.embedding_vector,
          input.limit || 5
        );
        
        console.log(`Found ${directResults.length} similar incidents via direct query`);
        
        return {
          similar_incidents: directResults,
          patterns: [],
          recommendations: [],
          source: 'direct_query'
        };
      } catch (error) {
        console.warn('Direct query failed, falling back to agent:', error.message);
      }
    }

    // Fall back to agent invocation
    const promptVariables = this.buildUserPrompt(input);

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1}/${this.maxRetries + 1}`);
        
        const response = await invoke('rovo.agent.invoke', {
          agentKey: this.agentKey,
          variables: promptVariables,
          timeout: this.timeout,
          // Pass embedding separately if supported
          context: input.embedding_vector ? {
            embedding: input.embedding_vector
          } : undefined
        });

        console.log('Received response from historian agent');
        const parsed = this.parseResponse(response.content || response);
        
        console.log('HistorianAgent: Query complete', {
          incident_count: parsed.similar_incidents?.length || 0,
          pattern_count: parsed.patterns?.length || 0
        });

        return { ...parsed, source: 'agent' };
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('HistorianAgent: All retry attempts failed');
    throw new Error(`Agent invocation failed after ${this.maxRetries + 1} attempts: ${lastError.message}`);
  }

  /**
   * Get incidents by file pattern
   */
  async queryByFilePattern(filePattern, limit = 10) {
    if (!this.supabaseClient) {
      throw new Error('Supabase client required for file pattern queries');
    }

    try {
      const { data, error } = await this.supabaseClient
        .from('code_incidents')
        .select('*')
        .ilike('file_path', `%${filePattern}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map(item => ({
        id: item.id,
        summary: item.summary,
        file_path: item.file_path,
        resolution: item.resolution,
        link: item.jira_link,
        occurred_at: item.created_at,
        severity: item.severity
      }));
    } catch (error) {
      console.error('File pattern query failed:', error);
      throw error;
    }
  }

  /**
   * Get recent high-severity incidents
   */
  async getRecentHighSeverity(days = 30, limit = 10) {
    if (!this.supabaseClient) {
      throw new Error('Supabase client required');
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data, error } = await this.supabaseClient
        .from('code_incidents')
        .select('*')
        .in('severity', ['high', 'critical'])
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Recent high-severity query failed:', error);
      throw error;
    }
  }

  /**
   * Format incidents for display
   */
  static formatIncidents(history) {
    if (!history || !history.similar_incidents || history.similar_incidents.length === 0) {
      return '📚 No similar historical incidents found.';
    }

    let output = `📚 **Historical Context (${history.similar_incidents.length} similar incidents)**\n\n`;

    history.similar_incidents.forEach((incident, idx) => {
      const severityEmoji = {
        critical: '🚨',
        high: '🔴',
        medium: '🟡',
        low: '🟢'
      };
      
      const emoji = severityEmoji[incident.severity] || '📋';
      const similarity = (incident.similarity * 100).toFixed(0);
      
      output += `${idx + 1}. ${emoji} **${incident.summary}** (${similarity}% similar)\n`;
      
      if (incident.resolution) {
        output += `   ✅ Resolution: ${incident.resolution}\n`;
      }
      
      if (incident.lessons && incident.lessons.length > 0) {
        output += `   💡 Lessons: ${incident.lessons.join(', ')}\n`;
      }
      
      if (incident.link) {
        output += `   🔗 [View Details](${incident.link})\n`;
      }
      
      output += '\n';
    });

    if (history.patterns && history.patterns.length > 0) {
      output += '🔍 **Observed Patterns:**\n';
      history.patterns.forEach(pattern => {
        output += `- ${pattern}\n`;
      });
      output += '\n';
    }

    if (history.recommendations && history.recommendations.length > 0) {
      output += '💡 **Recommendations Based on History:**\n';
      history.recommendations.forEach(rec => {
        output += `- ${rec}\n`;
      });
    }

    return output;
  }
}

// Export singleton and class
const historianAgent = new HistorianAgent();

module.exports = {
  HistorianAgent,
  historianAgent,
  queryHistory: (input) => historianAgent.query(input),
  formatIncidents: HistorianAgent.formatIncidents
};
