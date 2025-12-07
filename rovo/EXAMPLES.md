# Rovo Integration Examples

This document provides practical examples of using the Code Risk Radar Rovo agents and actions.

## Table of Contents
- [Quick Start](#quick-start)
- [Agent Examples](#agent-examples)
- [Action Examples](#action-examples)
- [Full Workflow Examples](#full-workflow-examples)
- [Integration Patterns](#integration-patterns)

---

## Quick Start

### Basic Setup in Forge App

```javascript
// In your Forge app index.js
const {
  analyzeRisk,
  queryHistory,
  executeAction,
  fullWorkflow
} = require('./src/rovoIntegration');

// Export handlers for Forge
exports.createJiraTaskHandler = require('./src/actions/createJiraTask').createJiraTaskHandler;
exports.postPRCommentHandler = require('./src/actions/postPRComment').postPRCommentHandler;
exports.createFixBranchPRHandler = require('./src/actions/createFixBranchPR').createFixBranchPRHandler;
```

---

## Agent Examples

### Example 1: Risk Analysis for PR

```javascript
const { analyzeRisk, formatRiskSummary } = require('./src/rovoIntegration');

async function analyzePullRequest(pr) {
  const input = {
    risk_score: 0.85,
    top_features: [
      { name: 'sql_keywords', importance: 0.45 },
      { name: 'user_input_usage', importance: 0.32 },
      { name: 'string_concatenation', importance: 0.23 }
    ],
    diff_snippet: `
+const username = req.body.username;
+const query = "SELECT * FROM users WHERE name='" + username + "'";
+db.query(query);
    `,
    file_path: 'src/auth/login.js',
    author: 'john.doe',
    pr_number: '123'
  };
  
  try {
    const analysis = await analyzeRisk(input);
    
    console.log('Risk Level:', analysis.risk_level);
    console.log('Explanation:', analysis.explanation);
    console.log('Actions:', analysis.actions.length);
    
    // Format for display
    const summary = formatRiskSummary(analysis);
    console.log('\n' + summary);
    
    return analysis;
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}
```

**Expected Output:**
```
Risk Level: critical
Explanation: This change introduces a critical SQL injection vulnerability by directly concatenating user input into a database query...
Actions: 2

🚨 Risk Level: CRITICAL

This change introduces a critical SQL injection vulnerability by directly concatenating user input into a database query...

Recommended Actions (2):
1. 🔴 [security] Use parameterized queries to prevent SQL injection
   ⏱️ 30 minutes | 🎯 95% confidence
2. 🔴 [security] Add input validation for username parameter
   ⏱️ 45 minutes | 🎯 85% confidence
```

### Example 2: Query Historical Incidents

```javascript
const { queryHistory, formatIncidents } = require('./src/rovoIntegration');

async function checkHistory(codeEmbedding) {
  const input = {
    embedding_vector: codeEmbedding, // 768-dim vector from embeddings
    code_signature: 'sql_user_input_concat',
    file_type: 'javascript',
    risk_area: 'authentication',
    risk_score: 0.85
  };
  
  try {
    const history = await queryHistory(input);
    
    console.log('Similar incidents found:', history.similar_incidents.length);
    
    if (history.similar_incidents.length > 0) {
      console.log('Top match:', history.similar_incidents[0].summary);
      console.log('Similarity:', history.similar_incidents[0].similarity);
    }
    
    // Format for display
    const formatted = formatIncidents(history);
    console.log('\n' + formatted);
    
    return history;
  } catch (error) {
    console.error('History query failed:', error);
    throw error;
  }
}
```

### Example 3: Combined Analysis

```javascript
const { performFullAnalysis } = require('./src/rovoIntegration');

async function analyzeWithHistory(input) {
  // Input includes both risk analysis and embedding
  const fullInput = {
    risk_score: 0.85,
    top_features: [...],
    diff_snippet: '...',
    embedding_vector: [...], // Include embedding for history
    file_path: 'src/auth/login.js',
    author: 'john.doe',
    pr_number: '123'
  };
  
  const results = await performFullAnalysis(fullInput);
  
  console.log('Risk Analysis:', results.risk_analysis.risk_level);
  console.log('Historical Incidents:', results.historical_context?.similar_incidents?.length || 0);
  console.log('\n--- Combined Summary ---');
  console.log(results.combined_summary);
  
  return results;
}
```

---

## Action Examples

### Example 4: Create Jira Task (Preview First)

```javascript
const { executeAction } = require('./src/rovoIntegration');

async function createTaskForRisk(analysis, metadata) {
  // Step 1: Preview the task
  console.log('Step 1: Generating preview...');
  const preview = await executeAction('jira', {
    risk_analysis: analysis,
    project_key: 'RISK',
    priority: 'High',
    metadata: metadata,
    confirm: false // Preview only
  });
  
  console.log('--- PREVIEW ---');
  console.log(preview.preview);
  
  // Step 2: User reviews and confirms
  const userConfirms = await askUserForConfirmation(preview.preview);
  
  if (!userConfirms) {
    console.log('User cancelled task creation');
    return null;
  }
  
  // Step 3: Execute with confirmation
  console.log('Step 2: Creating task...');
  const result = await executeAction('jira', {
    risk_analysis: analysis,
    project_key: 'RISK',
    priority: 'High',
    metadata: metadata,
    confirm: true // Execute
  });
  
  if (result.success) {
    console.log('✅ Task created:', result.task_key);
    console.log('🔗 URL:', result.task_url);
  } else {
    console.error('❌ Failed:', result.error);
  }
  
  return result;
}

async function askUserForConfirmation(preview) {
  // In real implementation, show preview to user and get confirmation
  // This could be via UI dialog, CLI prompt, etc.
  return true; // Placeholder
}
```

### Example 5: Post PR Comment

```javascript
const { executeAction } = require('./src/rovoIntegration');

async function addRiskCommentToPR(analysis, prInfo) {
  const input = {
    risk_analysis: analysis,
    pr_number: prInfo.number,
    repository: prInfo.repository, // 'owner/repo'
    metadata: {
      file_path: prInfo.file_path,
      risk_score: prInfo.risk_score,
      top_features: prInfo.top_features
    },
    confirm: true // Can auto-confirm for comments
  };
  
  const result = await executeAction('pr_comment', input);
  
  if (result.success) {
    console.log('✅ Comment posted:', result.comment_url);
    if (result.updated) {
      console.log('ℹ️ Updated existing comment');
    }
  } else {
    console.error('❌ Failed to post comment:', result.error);
  }
  
  return result;
}
```

### Example 6: Create Fix Branch (Manual Confirmation Required)

```javascript
const { executeAction } = require('./src/rovoIntegration');

async function createFixBranch(analysis, repoInfo) {
  // This action ALWAYS requires explicit confirmation
  try {
    const result = await executeAction('fix_branch', {
      risk_analysis: analysis,
      base_branch: 'main',
      fix_description: 'Implement parameterized queries to prevent SQL injection',
      repository: repoInfo.repository,
      metadata: {
        original_pr: repoInfo.pr_number,
        jira_task: repoInfo.jira_task
      },
      confirm: true // MUST be true
    });
    
    if (result.success) {
      console.log('✅ Fix branch created:', result.branch_name);
      console.log('📝 PR created:', result.pr_url);
      console.log('ℹ️ PR is in draft mode - review before publishing');
    } else {
      console.error('❌ Failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Error creating fix branch:', error);
    throw error;
  }
}
```

---

## Full Workflow Examples

### Example 7: Complete PR Review Workflow

```javascript
const { fullWorkflow } = require('./src/rovoIntegration');

async function reviewPullRequest(prData) {
  const input = {
    // Risk analysis inputs
    risk_score: prData.risk_score,
    top_features: prData.features,
    diff_snippet: prData.diff,
    embedding_vector: prData.embedding,
    file_path: prData.file,
    author: prData.author,
    pr_number: prData.number,
    
    // Action flags
    create_jira_task: true,
    post_pr_comment: true,
    
    // Action parameters
    project_key: 'RISK',
    repository: 'company/code-risk-radar',
    jira_priority: 'High'
  };
  
  // Run full workflow (preview mode)
  console.log('Running full analysis workflow...');
  const results = await fullWorkflow(input, false); // false = preview only
  
  // Display results
  console.log('\n=== ANALYSIS RESULTS ===');
  console.log('Risk Level:', results.analysis.risk_analysis.risk_level);
  console.log('Actions:', results.analysis.risk_analysis.actions.length);
  
  if (results.analysis.historical_context?.similar_incidents) {
    console.log('Historical matches:', 
      results.analysis.historical_context.similar_incidents.length);
  }
  
  // Show previews
  if (results.jira_task?.preview) {
    console.log('\n=== JIRA TASK PREVIEW ===');
    console.log(results.jira_task.preview);
  }
  
  if (results.pr_comment?.preview) {
    console.log('\n=== PR COMMENT PREVIEW ===');
    console.log(results.pr_comment.preview);
  }
  
  // Check for errors
  if (results.errors.length > 0) {
    console.error('\n=== ERRORS ===');
    results.errors.forEach(err => {
      console.error(`${err.step}: ${err.error}`);
    });
  }
  
  return results;
}
```

### Example 8: Batch Processing Multiple Changes

```javascript
const { processBatch } = require('./src/rovoIntegration');

async function reviewEntirePR(prChanges) {
  // prChanges is an array of file changes
  const changes = prChanges.map(change => ({
    risk_score: change.risk_score,
    top_features: change.features,
    diff_snippet: change.diff,
    embedding_vector: change.embedding,
    file_path: change.file,
    author: change.author,
    pr_number: change.pr_number,
    repository: 'company/code-risk-radar'
  }));
  
  console.log(`Processing ${changes.length} file changes...`);
  
  const results = await processBatch(changes, {
    autoExecute: false, // Preview only
    createJiraTasks: true,
    postPRComments: false, // Don't spam PRs with multiple comments
    concurrency: 3 // Process 3 at a time
  });
  
  // Aggregate results
  const highRiskFiles = results.results.filter(r => 
    r.result.analysis.risk_analysis.risk_level === 'high' ||
    r.result.analysis.risk_analysis.risk_level === 'critical'
  );
  
  console.log('\n=== BATCH RESULTS ===');
  console.log(`Total files: ${changes.length}`);
  console.log(`Successful: ${results.results.length}`);
  console.log(`Failed: ${results.errors.length}`);
  console.log(`High risk files: ${highRiskFiles.length}`);
  
  // Post a single summary comment
  if (highRiskFiles.length > 0) {
    await postBatchSummaryComment(highRiskFiles, change.pr_number);
  }
  
  return results;
}
```

---

## Integration Patterns

### Pattern 1: GitHub Webhook Handler

```javascript
const { fullWorkflow } = require('./src/rovoIntegration');

async function handlePullRequestEvent(webhook) {
  if (webhook.action !== 'opened' && webhook.action !== 'synchronize') {
    return; // Only process new PRs or updates
  }
  
  const pr = webhook.pull_request;
  
  // Get changed files
  const files = await getChangedFiles(pr.number);
  
  // Analyze each file
  for (const file of files) {
    // Get risk score from ML pipeline
    const riskScore = await getRiskScore(file);
    
    if (riskScore > 0.5) { // Only analyze risky changes
      const input = {
        risk_score: riskScore,
        top_features: await getTopFeatures(file),
        diff_snippet: file.patch,
        file_path: file.filename,
        author: pr.user.login,
        pr_number: pr.number,
        repository: webhook.repository.full_name,
        
        post_pr_comment: true, // Auto-post comments
        create_jira_task: riskScore > 0.8 // Only create tasks for high risk
      };
      
      await fullWorkflow(input, true); // Auto-execute
    }
  }
}
```

### Pattern 2: Scheduled Security Audit

```javascript
const { processBatch, analyzeRisk } = require('./src/rovoIntegration');

async function runSecurityAudit() {
  console.log('Starting scheduled security audit...');
  
  // Get all recent PRs
  const recentPRs = await getRecentMergedPRs(7); // Last 7 days
  
  // Extract changes
  const allChanges = [];
  for (const pr of recentPRs) {
    const files = await getChangedFiles(pr.number);
    for (const file of files) {
      allChanges.push({
        risk_score: await getRiskScore(file),
        diff_snippet: file.patch,
        file_path: file.filename,
        pr_number: pr.number,
        repository: pr.repository.full_name
      });
    }
  }
  
  // Process in batch
  const results = await processBatch(allChanges, {
    autoExecute: false, // Generate report only
    createJiraTasks: false,
    postPRComments: false
  });
  
  // Generate audit report
  const report = generateAuditReport(results);
  
  // Send to Slack/Email
  await sendAuditReport(report);
  
  return report;
}
```

### Pattern 3: Interactive CLI Tool

```javascript
const inquirer = require('inquirer');
const { analyzeRisk, executeAction } = require('./src/rovoIntegration');

async function interactiveReview() {
  // Get file to review
  const { filePath } = await inquirer.prompt([{
    type: 'input',
    name: 'filePath',
    message: 'Enter file path to review:'
  }]);
  
  // Load file and analyze
  const fileContent = await readFile(filePath);
  const analysis = await analyzeRisk({
    risk_score: await calculateRiskScore(fileContent),
    diff_snippet: fileContent,
    file_path: filePath
  });
  
  // Display results
  console.log('\n' + formatRiskSummary(analysis));
  
  // Ask what to do
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      'Create Jira Task',
      'Post PR Comment',
      'Both',
      'Nothing'
    ]
  }]);
  
  if (action === 'Create Jira Task' || action === 'Both') {
    const { projectKey } = await inquirer.prompt([{
      type: 'input',
      name: 'projectKey',
      message: 'Jira project key:',
      default: 'RISK'
    }]);
    
    await executeAction('jira', {
      risk_analysis: analysis,
      project_key: projectKey,
      confirm: true
    });
  }
  
  if (action === 'Post PR Comment' || action === 'Both') {
    const prInfo = await inquirer.prompt([
      { type: 'input', name: 'repository', message: 'Repository (owner/repo):' },
      { type: 'input', name: 'pr_number', message: 'PR number:' }
    ]);
    
    await executeAction('pr_comment', {
      risk_analysis: analysis,
      ...prInfo,
      confirm: true
    });
  }
}
```

### Pattern 4: VS Code Extension Integration

```javascript
// In VS Code extension
const vscode = require('vscode');
const { analyzeRisk, formatRiskSummary } = require('./src/rovoIntegration');

async function analyzeCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  
  const document = editor.document;
  const content = document.getText();
  
  // Show progress
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Analyzing code risk...',
    cancellable: false
  }, async () => {
    const analysis = await analyzeRisk({
      diff_snippet: content,
      file_path: document.fileName
    });
    
    // Show results in webview panel
    const panel = vscode.window.createWebviewPanel(
      'riskAnalysis',
      'Risk Analysis Results',
      vscode.ViewColumn.Beside,
      {}
    );
    
    panel.webview.html = getWebviewContent(analysis);
    
    // Highlight risky lines
    highlightRiskyLines(editor, analysis);
  });
}

function highlightRiskyLines(editor, analysis) {
  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
    border: '1px solid red'
  });
  
  const ranges = [];
  analysis.actions.forEach(action => {
    action.evidence_lines?.forEach(line => {
      // Find line number for evidence
      const lineNumber = findLineNumber(editor.document, line);
      if (lineNumber >= 0) {
        ranges.push(new vscode.Range(lineNumber, 0, lineNumber, 1000));
      }
    });
  });
  
  editor.setDecorations(decorationType, ranges);
}
```

---

## Error Handling Best Practices

```javascript
const { analyzeRisk, executeAction } = require('./src/rovoIntegration');

async function robustAnalysis(input) {
  try {
    const analysis = await analyzeRisk(input);
    return { success: true, data: analysis };
  } catch (error) {
    // Log error
    console.error('Analysis failed:', error);
    
    // Check error type
    if (error.message.includes('timeout')) {
      return { 
        success: false, 
        error: 'Analysis timed out',
        retry: true 
      };
    }
    
    if (error.message.includes('rate limit')) {
      return { 
        success: false, 
        error: 'Rate limited',
        retry: true,
        retryAfter: 60
      };
    }
    
    // Return fallback analysis
    return {
      success: false,
      error: error.message,
      fallback: {
        explanation: 'Automated analysis unavailable. Manual review recommended.',
        risk_level: 'medium',
        actions: []
      }
    };
  }
}
```

---

## Testing Examples

```javascript
// Test file: tests/rovo.test.js
const { analyzeRisk, executeAction } = require('../src/rovoIntegration');

describe('Rovo Integration Tests', () => {
  test('should analyze SQL injection risk', async () => {
    const input = {
      risk_score: 0.95,
      diff_snippet: "db.query(`SELECT * FROM users WHERE id='${userId}'`)",
      file_path: 'test.js'
    };
    
    const result = await analyzeRisk(input);
    
    expect(result.risk_level).toBe('critical');
    expect(result.actions).toHaveLength(greaterThan(0));
    expect(result.actions[0].type).toBe('security');
  });
  
  test('should generate Jira task preview', async () => {
    const analysis = {
      explanation: 'Test issue',
      risk_level: 'high',
      actions: []
    };
    
    const result = await executeAction('jira', {
      risk_analysis: analysis,
      project_key: 'TEST',
      confirm: false
    });
    
    expect(result.success).toBe(true);
    expect(result.preview).toBeDefined();
    expect(result.requires_confirmation).toBe(true);
  });
});
```

