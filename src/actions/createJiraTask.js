/**
 * Rovo Action: Create Jira Task
 * 
 * Creates a Jira task from risk analysis results.
 * Implements dry-run pattern: returns preview first, requires confirm=true to execute.
 */

const api = require('@forge/api');

/**
 * Example Input JSON:
 * {
 *   "risk_analysis": {
 *     "explanation": "Critical SQL injection vulnerability detected",
 *     "risk_level": "critical",
 *     "actions": [...]
 *   },
 *   "project_key": "RISK",
 *   "priority": "High",
 *   "confirm": false
 * }
 * 
 * Example Output JSON (preview):
 * {
 *   "preview": "📋 Task Preview:\n\nProject: RISK\nType: Bug\nPriority: High\nSummary: [CRITICAL] SQL injection vulnerability in src/auth/login.js\n\nDescription:\n...",
 *   "task_key": null,
 *   "task_url": null,
 *   "requires_confirmation": true
 * }
 * 
 * Example Output JSON (confirmed):
 * {
 *   "preview": null,
 *   "task_key": "RISK-1234",
 *   "task_url": "https://your-site.atlassian.net/browse/RISK-1234",
 *   "requires_confirmation": false,
 *   "created": true
 * }
 */

/**
 * Build Jira issue object from risk analysis
 */
function buildJiraIssue(riskAnalysis, projectKey, priority, metadata = {}) {
  const riskLevel = riskAnalysis.risk_level || 'medium';
  const filePath = metadata.file_path || 'unknown file';
  const prNumber = metadata.pr_number ? ` (PR #${metadata.pr_number})` : '';
  
  // Map risk level to priority if not explicitly set
  const riskToPriority = {
    critical: 'Highest',
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  };
  
  const issuePriority = priority || riskToPriority[riskLevel] || 'Medium';
  
  // Build summary
  const summary = `[${riskLevel.toUpperCase()}] ${riskAnalysis.explanation.substring(0, 100)}${prNumber}`;
  
  // Build description
  let description = `h2. Risk Analysis\n\n`;
  description += `*Risk Level:* {color:${getRiskColor(riskLevel)}}${riskLevel.toUpperCase()}{color}\n\n`;
  description += `*File:* {{${filePath}}}\n`;
  
  if (metadata.pr_number) {
    description += `*Pull Request:* #${metadata.pr_number}\n`;
  }
  
  if (metadata.author) {
    description += `*Author:* [~${metadata.author}]\n`;
  }
  
  if (metadata.risk_score) {
    description += `*Risk Score:* ${(metadata.risk_score * 100).toFixed(1)}%\n`;
  }
  
  description += `\n*Explanation:*\n${riskAnalysis.explanation}\n\n`;
  
  // Add actions
  if (riskAnalysis.actions && riskAnalysis.actions.length > 0) {
    description += `h3. Recommended Actions\n\n`;
    
    riskAnalysis.actions.forEach((action, idx) => {
      const priorityIcon = action.priority === 'high' ? '(!)' :
                          action.priority === 'medium' ? '(i)' : '(/)';
      
      description += `${idx + 1}. ${priorityIcon} *[${action.type.toUpperCase()}]* ${action.description}\n`;
      description += `   * Effort: ${action.effort_estimate}\n`;
      description += `   * Confidence: ${(action.confidence * 100).toFixed(0)}%\n`;
      
      if (action.evidence_lines && action.evidence_lines.length > 0) {
        description += `   * Evidence:\n`;
        action.evidence_lines.forEach(line => {
          description += `   ** {{${line}}}\n`;
        });
      }
      description += '\n';
    });
  }
  
  // Add labels
  const labels = [
    'code-risk-radar',
    `risk-${riskLevel}`,
    'automated-detection'
  ];
  
  if (metadata.file_type) {
    labels.push(metadata.file_type);
  }
  
  if (riskAnalysis.actions) {
    const types = [...new Set(riskAnalysis.actions.map(a => a.type))];
    labels.push(...types.map(t => `action-${t}`));
  }
  
  return {
    fields: {
      project: { key: projectKey },
      summary,
      description,
      issuetype: { name: 'Bug' },
      priority: { name: issuePriority },
      labels
    }
  };
}

/**
 * Get color for risk level
 */
function getRiskColor(level) {
  const colors = {
    critical: 'red',
    high: 'red',
    medium: 'yellow',
    low: 'green'
  };
  return colors[level] || 'gray';
}

/**
 * Generate preview text
 */
function generatePreview(issueData, projectKey) {
  const { summary, description, priority, labels } = issueData.fields;
  
  let preview = `📋 **Jira Task Preview**\n\n`;
  preview += `**Project:** ${projectKey}\n`;
  preview += `**Type:** Bug\n`;
  preview += `**Priority:** ${priority.name}\n`;
  preview += `**Summary:** ${summary}\n\n`;
  preview += `**Description:**\n${description}\n\n`;
  preview += `**Labels:** ${labels.join(', ')}\n\n`;
  preview += `---\n\n`;
  preview += `⚠️ **This is a preview.** Set \`confirm=true\` to create the task.\n`;
  
  return preview;
}

/**
 * Validate input parameters
 */
function validateInput(input) {
  const errors = [];
  
  if (!input.risk_analysis) {
    errors.push('risk_analysis is required');
  } else {
    if (typeof input.risk_analysis === 'string') {
      try {
        input.risk_analysis = JSON.parse(input.risk_analysis);
      } catch (e) {
        errors.push('risk_analysis must be valid JSON');
      }
    }
    
    if (!input.risk_analysis.explanation) {
      errors.push('risk_analysis.explanation is required');
    }
  }
  
  if (!input.project_key) {
    errors.push('project_key is required');
  } else if (!/^[A-Z][A-Z0-9]{1,9}$/.test(input.project_key)) {
    errors.push('project_key must be a valid Jira project key (e.g., RISK, PROJ)');
  }
  
  const validPriorities = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
  if (input.priority && !validPriorities.includes(input.priority)) {
    errors.push(`priority must be one of: ${validPriorities.join(', ')}`);
  }
  
  return errors;
}

/**
 * Main action handler
 */
async function createJiraTaskHandler(input) {
  console.log('createJiraTaskHandler invoked', {
    project_key: input.project_key,
    confirm: input.confirm,
    has_risk_analysis: !!input.risk_analysis
  });
  
  // Validate input
  const validationErrors = validateInput(input);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: validationErrors.join('; '),
      preview: null,
      task_key: null,
      task_url: null
    };
  }
  
  const {
    risk_analysis,
    project_key,
    priority,
    confirm = false,
    metadata = {}
  } = input;
  
  // Build Jira issue
  let issueData;
  try {
    issueData = buildJiraIssue(risk_analysis, project_key, priority, metadata);
  } catch (error) {
    console.error('Failed to build Jira issue:', error);
    return {
      success: false,
      error: `Failed to build issue: ${error.message}`,
      preview: null,
      task_key: null,
      task_url: null
    };
  }
  
  // DRY RUN: Return preview
  if (!confirm) {
    console.log('Returning preview (confirm=false)');
    return {
      success: true,
      preview: generatePreview(issueData, project_key),
      task_key: null,
      task_url: null,
      requires_confirmation: true,
      issue_data: issueData // Include for debugging
    };
  }
  
  // CONFIRMED: Create the task
  console.log('Creating Jira task (confirm=true)');
  
  try {
    const response = await api.asApp().requestJira('/rest/api/3/issue', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(issueData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const taskKey = result.key;
    const taskUrl = `${await getJiraBaseUrl()}/browse/${taskKey}`;
    
    console.log('Jira task created successfully:', taskKey);
    
    // Log to audit trail
    await logAuditEvent({
      action: 'create_jira_task',
      task_key: taskKey,
      risk_level: risk_analysis.risk_level,
      metadata
    });
    
    return {
      success: true,
      preview: null,
      task_key: taskKey,
      task_url: taskUrl,
      requires_confirmation: false,
      created: true
    };
  } catch (error) {
    console.error('Failed to create Jira task:', error);
    return {
      success: false,
      error: error.message,
      preview: null,
      task_key: null,
      task_url: null
    };
  }
}

/**
 * Get Jira base URL
 */
async function getJiraBaseUrl() {
  try {
    const response = await api.asApp().requestJira('/rest/api/3/serverInfo');
    const data = await response.json();
    return data.baseUrl;
  } catch (error) {
    console.error('Failed to get Jira base URL:', error);
    return 'https://your-site.atlassian.net';
  }
}

/**
 * Log audit event
 */
async function logAuditEvent(event) {
  try {
    // Store in Forge storage or external system
    const { storage } = require('@forge/api');
    const auditLog = await storage.get('audit_log') || [];
    
    auditLog.push({
      ...event,
      timestamp: new Date().toISOString(),
      user: 'system' // Or get from context
    });
    
    // Keep last 1000 events
    if (auditLog.length > 1000) {
      auditLog.shift();
    }
    
    await storage.set('audit_log', auditLog);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

module.exports = {
  createJiraTaskHandler,
  buildJiraIssue,
  generatePreview,
  validateInput
};
