/**
 * Rovo Integration Index
 * 
 * Central export point for all Rovo agents and actions.
 * Use this in your Forge app's main index.js
 */

// Import agents
const { 
  riskAnalystAgent,
  analyzeRisk,
  analyzeBatch: analyzeBatchRisk,
  formatSummary: formatRiskSummary
} = require('./rovo/riskAgent');

const {
  historianAgent,
  queryHistory,
  formatIncidents
} = require('./rovo/historianAgent');

// Import actions
const { createJiraTaskHandler } = require('./actions/createJiraTask');
const { postPRCommentHandler } = require('./actions/postPRComment');
const { createFixBranchPRHandler } = require('./actions/createFixBranchPR');

/**
 * Combined analysis workflow
 * 
 * @param {Object} input - Combined input for risk analysis and history
 * @returns {Object} Combined results
 */
async function performFullAnalysis(input) {
  console.log('performFullAnalysis: Starting comprehensive analysis');
  
  try {
    // Parallel execution of risk analysis and history query
    const [riskResult, historyResult] = await Promise.all([
      analyzeRisk(input),
      input.embedding_vector ? queryHistory(input) : Promise.resolve(null)
    ]);
    
    console.log('performFullAnalysis: Both analyses complete');
    
    return {
      risk_analysis: riskResult,
      historical_context: historyResult,
      combined_summary: generateCombinedSummary(riskResult, historyResult),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('performFullAnalysis: Error during analysis', error);
    throw error;
  }
}

/**
 * Generate combined summary for display
 */
function generateCombinedSummary(riskAnalysis, history) {
  let summary = formatRiskSummary(riskAnalysis);
  
  if (history && history.similar_incidents && history.similar_incidents.length > 0) {
    summary += '\n\n---\n\n';
    summary += formatIncidents(history);
  }
  
  return summary;
}

/**
 * Execute action workflow with preview
 * 
 * @param {string} actionType - 'jira' | 'pr_comment' | 'fix_branch'
 * @param {Object} input - Action input parameters
 * @param {boolean} confirm - Whether to execute (default: preview only)
 * @returns {Object} Action result
 */
async function executeAction(actionType, input, confirm = false) {
  console.log(`executeAction: ${actionType} (confirm=${confirm})`);
  
  // Ensure confirm flag is properly set
  input.confirm = confirm;
  
  let handler;
  switch (actionType) {
    case 'jira':
    case 'createJiraTask':
      handler = createJiraTaskHandler;
      break;
    case 'pr_comment':
    case 'postPRComment':
      handler = postPRCommentHandler;
      break;
    case 'fix_branch':
    case 'createFixBranchPR':
      handler = createFixBranchPRHandler;
      break;
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
  
  const result = await handler(input);
  
  console.log(`executeAction: ${actionType} complete`, {
    success: result.success,
    requires_confirmation: result.requires_confirmation
  });
  
  return result;
}

/**
 * End-to-end workflow: Analyze -> Create Jira -> Post PR Comment
 * 
 * @param {Object} input - Full workflow input
 * @param {boolean} autoExecute - Whether to auto-confirm actions (default: preview only)
 * @returns {Object} Workflow results
 */
async function fullWorkflow(input, autoExecute = false) {
  console.log('fullWorkflow: Starting end-to-end workflow');
  
  const results = {
    analysis: null,
    jira_task: null,
    pr_comment: null,
    errors: []
  };
  
  try {
    // Step 1: Perform full analysis
    console.log('Step 1: Performing analysis');
    results.analysis = await performFullAnalysis(input);
    
    // Step 2: Create Jira task (if requested)
    if (input.create_jira_task && input.project_key) {
      console.log('Step 2: Creating Jira task');
      try {
        results.jira_task = await executeAction('jira', {
          risk_analysis: results.analysis.risk_analysis,
          project_key: input.project_key,
          priority: input.jira_priority,
          metadata: {
            file_path: input.file_path,
            pr_number: input.pr_number,
            author: input.author,
            risk_score: input.risk_score
          }
        }, autoExecute);
      } catch (error) {
        console.error('Failed to create Jira task:', error);
        results.errors.push({ step: 'jira_task', error: error.message });
      }
    }
    
    // Step 3: Post PR comment (if requested)
    if (input.post_pr_comment && input.pr_number && input.repository) {
      console.log('Step 3: Posting PR comment');
      try {
        results.pr_comment = await executeAction('pr_comment', {
          risk_analysis: results.analysis.risk_analysis,
          pr_number: input.pr_number,
          repository: input.repository,
          metadata: {
            file_path: input.file_path,
            risk_score: input.risk_score,
            top_features: input.top_features,
            historical_context: formatIncidents(results.analysis.historical_context)
          }
        }, autoExecute);
      } catch (error) {
        console.error('Failed to post PR comment:', error);
        results.errors.push({ step: 'pr_comment', error: error.message });
      }
    }
    
    console.log('fullWorkflow: Complete', {
      analysis_complete: !!results.analysis,
      jira_created: results.jira_task?.created || false,
      pr_commented: results.pr_comment?.posted || false,
      error_count: results.errors.length
    });
    
    return results;
  } catch (error) {
    console.error('fullWorkflow: Critical error', error);
    results.errors.push({ step: 'workflow', error: error.message });
    return results;
  }
}

/**
 * Batch processing for multiple changes
 */
async function processBatch(changes, options = {}) {
  console.log(`processBatch: Processing ${changes.length} changes`);
  
  const {
    autoExecute = false,
    createJiraTasks = false,
    postPRComments = false,
    concurrency = 3
  } = options;
  
  const results = [];
  const errors = [];
  
  // Process in chunks to avoid overwhelming the system
  for (let i = 0; i < changes.length; i += concurrency) {
    const chunk = changes.slice(i, i + concurrency);
    
    const chunkResults = await Promise.all(
      chunk.map(async (change, idx) => {
        try {
          const input = {
            ...change,
            create_jira_task: createJiraTasks,
            post_pr_comment: postPRComments
          };
          
          const result = await fullWorkflow(input, autoExecute);
          return { success: true, index: i + idx, result };
        } catch (error) {
          console.error(`Batch item ${i + idx} failed:`, error);
          return { 
            success: false, 
            index: i + idx, 
            error: error.message,
            change
          };
        }
      })
    );
    
    chunkResults.forEach(r => {
      if (r.success) {
        results.push(r);
      } else {
        errors.push(r);
      }
    });
    
    console.log(`processBatch: Chunk ${Math.floor(i / concurrency) + 1} complete`);
  }
  
  console.log(`processBatch: Complete - ${results.length} succeeded, ${errors.length} failed`);
  
  return { results, errors };
}

// Export everything
module.exports = {
  // Agents
  riskAnalystAgent,
  historianAgent,
  
  // Agent functions
  analyzeRisk,
  analyzeBatchRisk,
  queryHistory,
  
  // Formatting
  formatRiskSummary,
  formatIncidents,
  generateCombinedSummary,
  
  // Actions
  createJiraTaskHandler,
  postPRCommentHandler,
  createFixBranchPRHandler,
  
  // Workflows
  performFullAnalysis,
  executeAction,
  fullWorkflow,
  processBatch
};
