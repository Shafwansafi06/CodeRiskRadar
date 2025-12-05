import api, { route } from '@forge/api';
import { generateDryRunPreview } from './dryRunService';
import { storeApprovalRequest, getApprovalStatus } from './storage';

/**
 * Create Jira issue with user confirmation (dry-run first)
 */
export async function createJiraIssueWithConfirmation(risk, prContext) {
  const issuePayload = buildJiraIssuePayload(risk, prContext);
  
  // Generate dry-run preview
  const preview = await generateDryRunPreview('CREATE_JIRA_ISSUE', issuePayload);
  
  // Store approval request
  const approvalId = await storeApprovalRequest({
    type: 'CREATE_JIRA_ISSUE',
    payload: issuePayload,
    preview,
    prId: prContext.prId,
    riskId: risk.id,
    status: 'PENDING'
  });
  
  return {
    approvalId,
    preview,
    message: 'Approval required to create Jira issue'
  };
}

/**
 * Execute approved Jira issue creation
 */
export async function executeApprovedJiraCreation(approvalId) {
  const approval = await getApprovalStatus(approvalId);
  
  if (approval.status !== 'APPROVED') {
    throw new Error('Action not approved by user');
  }
  
  const { payload } = approval;
  
  try {
    const response = await api.asApp().requestJira(
      route`/rest/api/3/issue`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
    
    const issue = await response.json();
    
    // Log to audit trail
    await logAuditEvent({
      approvalId,
      action: 'CREATE_JIRA_ISSUE',
      issueKey: issue.key,
      timestamp: new Date().toISOString()
    });
    
    return issue;
    
  } catch (error) {
    console.error('Failed to create Jira issue:', error);
    throw error;
  }
}

/**
 * Update existing Jira issue with risk details
 */
export async function updateJiraIssueWithConfirmation(issueKey, risk, prContext) {
  const updatePayload = buildJiraUpdatePayload(issueKey, risk, prContext);
  
  // Generate dry-run preview
  const preview = await generateDryRunPreview('UPDATE_JIRA_ISSUE', {
    issueKey,
    ...updatePayload
  });
  
  // Store approval request
  const approvalId = await storeApprovalRequest({
    type: 'UPDATE_JIRA_ISSUE',
    payload: { issueKey, ...updatePayload },
    preview,
    prId: prContext.prId,
    riskId: risk.id,
    status: 'PENDING'
  });
  
  return {
    approvalId,
    preview,
    message: 'Approval required to update Jira issue'
  };
}

/**
 * Build Jira issue creation payload
 */
function buildJiraIssuePayload(risk, prContext) {
  const { prId, repoSlug, workspaceSlug } = prContext;
  
  return {
    fields: {
      project: {
        key: process.env.JIRA_PROJECT_KEY || 'RISK'
      },
      summary: `[Code Risk] ${risk.name} in PR #${prId}`,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `Risk detected by Code Risk Radar in PR #${prId}`
              }
            ]
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Risk Details' }]
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: `Type: ${risk.type}` }]
                }]
              },
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: `Severity: ${risk.severity}` }]
                }]
              },
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: `Category: ${risk.category}` }]
                }]
              },
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: `Priority: ${risk.priority}` }]
                }]
              }
            ]
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Description' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: risk.description }]
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Code Snippet' }]
          },
          {
            type: 'codeBlock',
            content: [{ type: 'text', text: risk.snippet || 'N/A' }]
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Suggested Fix' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: risk.suggestedFix || 'Review manually' }]
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `Repository: ${workspaceSlug}/${repoSlug}`,
                marks: [{ type: 'em' }]
              }
            ]
          }
        ]
      },
      issuetype: {
        name: 'Bug'
      },
      priority: {
        name: risk.priority === 'CRITICAL' ? 'Highest' : risk.priority === 'HIGH' ? 'High' : 'Medium'
      },
      labels: ['code-risk', 'security', `pr-${prId}`]
    }
  };
}

/**
 * Build Jira issue update payload
 */
function buildJiraUpdatePayload(issueKey, risk, prContext) {
  return {
    update: {
      comment: [
        {
          add: {
            body: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: `Additional risk detected: ${risk.name}`,
                      marks: [{ type: 'strong' }]
                    }
                  ]
                },
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: risk.description }]
                }
              ]
            }
          }
        }
      ]
    }
  };
}

/**
 * Log audit event to Forge storage
 */
async function logAuditEvent(event) {
  const { storage } = await import('@forge/api');
  
  const auditLog = await storage.get('audit-log') || [];
  auditLog.push(event);
  
  // Keep only last 1000 events
  if (auditLog.length > 1000) {
    auditLog.shift();
  }
  
  await storage.set('audit-log', auditLog);
}
