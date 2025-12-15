/**
 * API Bridge for Forge Backend
 * 
 * Handles communication between React UI and Forge backend functions.
 * Automatically detects Forge environment vs. local development.
 */

// Safely import Forge bridge only if available
let invoke = null;
try {
  const forgeBridge = require('@forge/bridge');
  invoke = forgeBridge.invoke;
} catch (e) {
  // Running in local dev mode, no Forge bridge available
  console.log('[DEV MODE] Forge bridge not available, using mock data');
}

// Check if running in Forge environment
const isForgeEnvironment = typeof window !== 'undefined' && window.AP && invoke !== null;

/**
 * Load mock data for local development
 */
async function loadMockData() {
  try {
    const response = await fetch('/scripts/sample_prs.json');
    return await response.json();
  } catch (error) {
    console.error('Failed to load mock data:', error);
    return getMockDataFallback();
  }
}

/**
 * Fallback mock data if file not available
 */
function getMockDataFallback() {
  return {
    risk_analysis: {
      risk_score: 0.85,
      risk_level: 'critical',
      explanation: 'Critical SQL injection vulnerability detected in authentication endpoint.',
      actions: [
        {
          type: 'security',
          priority: 'high',
          description: 'Use parameterized queries to prevent SQL injection',
          evidence_lines: ['db.query(`SELECT * FROM users WHERE name=\'${username}\'`)'],
          effort_estimate: '30 minutes',
          confidence: 0.95
        },
        {
          type: 'security',
          priority: 'high',
          description: 'Add input validation for username parameter',
          evidence_lines: ['const username = req.body.username;'],
          effort_estimate: '45 minutes',
          confidence: 0.85
        }
      ],
      top_features: [
        { name: 'sql_keywords', importance: 0.45 },
        { name: 'user_input_usage', importance: 0.32 },
        { name: 'string_concatenation', importance: 0.23 }
      ]
    },
    historical_context: {
      similar_incidents: [
        {
          id: 'INC-2023-045',
          summary: 'SQL injection in user authentication endpoint',
          similarity: 0.92,
          resolution: 'Implemented parameterized queries and input validation',
          link: 'https://jira.company.com/browse/INC-2023-045',
          lessons: ['Always use parameterized queries', 'Add input validation layer'],
          severity: 'critical',
          occurred_at: '2023-08-15T10:30:00Z'
        },
        {
          id: 'INC-2023-112',
          summary: 'Authentication bypass via SQL injection',
          similarity: 0.87,
          resolution: 'Refactored authentication logic with ORM',
          link: 'https://jira.company.com/browse/INC-2023-112',
          lessons: ['Use ORM instead of raw queries'],
          severity: 'high',
          occurred_at: '2023-09-22T14:15:00Z'
        }
      ],
      patterns: [
        'SQL injection vulnerabilities often occur in authentication code',
        'Direct string concatenation in queries is a common root cause'
      ],
      recommendations: [
        'Implement automated SQL injection testing in CI/CD pipeline',
        'Consider using an ORM to reduce direct SQL query writing'
      ]
    },
    metadata: {
      file_path: 'src/auth/login.js',
      pr_number: '123',
      repository: 'company/code-risk-radar',
      author: 'john.doe',
      branch: 'feature/auth-improvements',
      diff_url: 'https://bitbucket.org/company/code-risk-radar/pull-requests/123/diff'
    }
  };
}

/**
 * Get risk analysis for current PR
 */
export async function getRiskAnalysis() {
  if (!isForgeEnvironment) {
    console.log('[DEV MODE] Loading mock data');
    return loadMockData();
  }

  try {
    const result = await invoke('getRiskAnalysis');
    return result;
  } catch (error) {
    console.error('Failed to get risk analysis:', error);
    throw error;
  }
}

/**
 * Create Jira task from risk analysis
 * @param {Object} riskAnalysis - Risk analysis data
 * @param {boolean} confirm - Whether to actually create (true) or preview (false)
 */
export async function createJiraTask(riskAnalysis, confirm = false) {
  if (!isForgeEnvironment) {
    console.log('[DEV MODE] Simulating Jira task creation');
    return {
      success: true,
      preview: confirm ? null : generateMockJiraPreview(riskAnalysis),
      task_key: confirm ? 'RISK-1234' : null,
      task_url: confirm ? 'https://jira.company.com/browse/RISK-1234' : null,
      requires_confirmation: !confirm
    };
  }

  try {
    const result = await invoke('createJiraTask', {
      risk_analysis: riskAnalysis,
      confirm
    });
    return result;
  } catch (error) {
    console.error('Failed to create Jira task:', error);
    throw error;
  }
}

/**
 * Post PR comment with risk analysis
 * @param {Object} riskAnalysis - Risk analysis data
 * @param {boolean} confirm - Whether to actually post (true) or preview (false)
 */
export async function postPRComment(riskAnalysis, confirm = false) {
  if (!isForgeEnvironment) {
    console.log('[DEV MODE] Simulating PR comment');
    return {
      success: true,
      preview: confirm ? null : generateMockPRCommentPreview(riskAnalysis),
      comment_id: confirm ? '987654321' : null,
      comment_url: confirm ? 'https://github.com/company/repo/pull/123#issuecomment-987654321' : null,
      requires_confirmation: !confirm
    };
  }

  try {
    const result = await invoke('postPRComment', {
      risk_analysis: riskAnalysis,
      confirm
    });
    return result;
  } catch (error) {
    console.error('Failed to post PR comment:', error);
    throw error;
  }
}

/**
 * Get historical similar incidents
 * @param {Array} embedding - Code embedding vector
 */
export async function getSimilarIncidents(embedding) {
  if (!isForgeEnvironment) {
    console.log('[DEV MODE] Loading mock historical data');
    const mockData = await loadMockData();
    return mockData.historical_context;
  }

  try {
    const result = await invoke('getSimilarIncidents', { embedding });
    return result;
  } catch (error) {
    console.error('Failed to get similar incidents:', error);
    throw error;
  }
}

/**
 * Refresh risk analysis
 */
export async function refreshAnalysis() {
  if (!isForgeEnvironment) {
    console.log('[DEV MODE] Refreshing mock data');
    return loadMockData();
  }

  try {
    const result = await invoke('refreshAnalysis');
    return result;
  } catch (error) {
    console.error('Failed to refresh analysis:', error);
    throw error;
  }
}

// Mock preview generators for dev mode
function generateMockJiraPreview(riskAnalysis) {
  return `📋 **Jira Task Preview**

**Project:** RISK
**Type:** Bug
**Priority:** ${riskAnalysis.risk_level === 'critical' ? 'Highest' : 'High'}
**Summary:** [${riskAnalysis.risk_level.toUpperCase()}] ${riskAnalysis.explanation.substring(0, 80)}

**Description:**
${riskAnalysis.explanation}

**Recommended Actions:**
${riskAnalysis.actions.map((action, idx) => `${idx + 1}. ${action.description}`).join('\n')}

⚠️ **This is a preview.** Confirm to create the task.`;
}

function generateMockPRCommentPreview(riskAnalysis) {
  return `# 🚨 Code Risk Radar Analysis

**Risk Level:** ${riskAnalysis.risk_level.toUpperCase()}

## Analysis
${riskAnalysis.explanation}

## Recommended Actions
${riskAnalysis.actions.map((action, idx) => 
  `${idx + 1}. **[${action.type.toUpperCase()}]** ${action.description}\n   - Effort: ${action.effort_estimate} | Confidence: ${(action.confidence * 100).toFixed(0)}%`
).join('\n')}

---
🤖 Generated by Code Risk Radar

⚠️ **This is a preview.** Confirm to post the comment.`;
}

export default {
  getRiskAnalysis,
  createJiraTask,
  postPRComment,
  getSimilarIncidents,
  refreshAnalysis,
  isForgeEnvironment
};

// Named export for direct access
export { isForgeEnvironment };
