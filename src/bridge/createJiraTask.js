import Resolver from '@forge/resolver';
import { createJiraTaskHandler } from '../actions/createJiraTask';

const resolver = new Resolver();

/**
 * Create Jira task from risk analysis
 */
resolver.define('createJiraTask', async (req) => {
  const { payload, context } = req;
  
  console.log('createJiraTask invoked');
  console.log('Payload:', payload);

  try {
    const { risk_analysis, confirm } = payload;
    
    if (!risk_analysis) {
      throw new Error('Missing risk_analysis in payload');
    }

    // Extract PR context for linking
    const prContext = extractPRContext(context);

    // Call the action handler
    const result = await createJiraTaskHandler({
      risk_analysis,
      pr_number: prContext.prNumber,
      repository: prContext.repository,
      diff_url: prContext.diffUrl,
      confirm: confirm === true
    });

    console.log('Jira task result:', result);
    return result;

  } catch (error) {
    console.error('Create Jira task failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Extract PR context helper
 */
function extractPRContext(context) {
  if (context.extension?.pullRequest) {
    const pr = context.extension.pullRequest;
    const repo = context.extension.repository;
    return {
      prNumber: pr.id,
      repository: repo?.full_name || repo?.name,
      diffUrl: pr.links?.diff?.href
    };
  }
  
  if (context.extension?.pull_request) {
    const pr = context.extension.pull_request;
    const repo = context.extension.repository;
    return {
      prNumber: pr.number,
      repository: repo?.full_name,
      diffUrl: pr.diff_url
    };
  }
  
  return {};
}

export const handler = resolver.getDefinitions();
