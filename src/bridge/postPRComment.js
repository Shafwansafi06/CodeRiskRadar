import Resolver from '@forge/resolver';
import { postPRCommentHandler } from '../actions/postPRComment';

const resolver = new Resolver();

/**
 * Post PR comment with risk analysis
 */
resolver.define('postPRComment', async (req) => {
  const { payload, context } = req;
  
  console.log('postPRComment invoked');
  console.log('Payload:', payload);

  try {
    const { risk_analysis, confirm } = payload;
    
    if (!risk_analysis) {
      throw new Error('Missing risk_analysis in payload');
    }

    // Extract PR context
    const prContext = extractPRContext(context);
    
    if (!prContext.prNumber || !prContext.repository) {
      throw new Error('Invalid PR context');
    }

    // Call the action handler
    const result = await postPRCommentHandler({
      risk_analysis,
      pr_number: prContext.prNumber,
      repository: prContext.repository,
      provider: prContext.provider,
      confirm: confirm === true
    });

    console.log('PR comment result:', result);
    return result;

  } catch (error) {
    console.error('Post PR comment failed:', error);
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
      provider: 'bitbucket'
    };
  }
  
  if (context.extension?.pull_request) {
    const pr = context.extension.pull_request;
    const repo = context.extension.repository;
    return {
      prNumber: pr.number,
      repository: repo?.full_name,
      provider: 'github'
    };
  }
  
  return {};
}

export const handler = resolver.getDefinitions();
