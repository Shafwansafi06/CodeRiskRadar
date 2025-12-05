/**
 * Generate dry-run preview for write operations
 */
export async function generateDryRunPreview(operationType, payload) {
  switch (operationType) {
    case 'CREATE_JIRA_ISSUE':
      return generateJiraIssuePreview(payload);
    
    case 'UPDATE_JIRA_ISSUE':
      return generateJiraUpdatePreview(payload);
    
    case 'COMMIT_FIX':
      return generateCommitPreview(payload);
    
    case 'ADD_PR_COMMENT':
      return generatePrCommentPreview(payload);
    
    default:
      return { type: operationType, preview: 'No preview available' };
  }
}

/**
 * Generate preview for Jira issue creation
 */
function generateJiraIssuePreview(payload) {
  const { fields } = payload;
  
  return {
    type: 'CREATE_JIRA_ISSUE',
    summary: fields.summary,
    description: extractTextFromADF(fields.description),
    project: fields.project.key,
    issueType: fields.issuetype.name,
    priority: fields.priority.name,
    labels: fields.labels,
    preview: formatJiraPreview(fields)
  };
}

/**
 * Generate preview for Jira issue update
 */
function generateJiraUpdatePreview(payload) {
  const { issueKey, update } = payload;
  
  return {
    type: 'UPDATE_JIRA_ISSUE',
    issueKey,
    changes: {
      comments: update.comment ? update.comment.map(c => 
        extractTextFromADF(c.add.body)
      ) : []
    },
    preview: `Will add comment to ${issueKey}:\n${extractTextFromADF(update.comment[0].add.body)}`
  };
}

/**
 * Generate preview for code commit
 */
function generateCommitPreview(payload) {
  const { fileName, diff, commitMessage } = payload;
  
  return {
    type: 'COMMIT_FIX',
    fileName,
    commitMessage,
    diff,
    preview: `File: ${fileName}\nMessage: ${commitMessage}\n\nDiff:\n${diff}`
  };
}

/**
 * Generate preview for PR comment
 */
function generatePrCommentPreview(payload) {
  const { prId, comment } = payload;
  
  return {
    type: 'ADD_PR_COMMENT',
    prId,
    comment,
    preview: `Will post comment on PR #${prId}:\n\n${comment}`
  };
}

/**
 * Extract plain text from Atlassian Document Format (ADF)
 */
function extractTextFromADF(adf) {
  if (typeof adf === 'string') {
    return adf;
  }
  
  if (!adf || !adf.content) {
    return '';
  }
  
  let text = '';
  
  function traverse(node) {
    if (node.type === 'text') {
      text += node.text;
    } else if (node.content) {
      node.content.forEach(traverse);
    }
    
    // Add spacing after block elements
    if (['paragraph', 'heading', 'listItem'].includes(node.type)) {
      text += '\n';
    }
  }
  
  traverse(adf);
  return text.trim();
}

/**
 * Format Jira issue preview for display
 */
function formatJiraPreview(fields) {
  return `
📝 **New Jira Issue Preview**

**Project:** ${fields.project.key}
**Type:** ${fields.issuetype.name}
**Priority:** ${fields.priority.name}

**Summary:**
${fields.summary}

**Description:**
${extractTextFromADF(fields.description)}

**Labels:**
${fields.labels.join(', ')}
`.trim();
}
