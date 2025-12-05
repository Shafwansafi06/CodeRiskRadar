import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { analyzeRisks } from './riskAnalyzer';
import { createJiraIssueWithConfirmation } from './jiraIntegration';
import { storePrRisks, getPrRisks } from './storage';

const resolver = new Resolver();

/**
 * Handler for PR created webhook
 */
resolver.define('handlePrCreated', async ({ payload }) => {
  console.log('PR Created:', payload.pullrequest.id);
  
  try {
    const prId = payload.pullrequest.id;
    const repoSlug = payload.repository.slug;
    const workspaceSlug = payload.repository.workspace.slug;
    
    // Fetch PR diff
    const diffResponse = await api.asApp().requestBitbucket(
      route`/2.0/repositories/${workspaceSlug}/${repoSlug}/pullrequests/${prId}/diff`
    );
    
    const diffText = await diffResponse.text();
    
    // Analyze risks
    const risks = await analyzeRisks(diffText, {
      prId,
      repoSlug,
      workspaceSlug
    });
    
    // Store results
    await storePrRisks(prId, risks);
    
    // Create Jira issues for high severity risks (requires user confirmation)
    const highSeverityRisks = risks.filter(r => r.severity === 'HIGH');
    
    if (highSeverityRisks.length > 0) {
      // Post comment on PR with risk summary
      await api.asApp().requestBitbucket(
        route`/2.0/repositories/${workspaceSlug}/${repoSlug}/pullrequests/${prId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: {
              raw: `⚠️ **Code Risk Radar** detected ${highSeverityRisks.length} high-severity risk(s). Review in the Risk Analysis panel.`
            }
          })
        }
      );
    }
    
    console.log(`Analyzed PR ${prId}: found ${risks.length} risks`);
    return { success: true, riskCount: risks.length };
    
  } catch (error) {
    console.error('Error analyzing PR:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handler for PR updated webhook
 */
resolver.define('handlePrUpdated', async ({ payload }) => {
  console.log('PR Updated:', payload.pullrequest.id);
  // Reuse the same logic as PR created
  return resolver.resolve('handlePrCreated', { payload });
});

/**
 * Render PR panel UI
 */
resolver.define('prPanel', async (req) => {
  const { context } = req;
  const prId = context.extension.pullRequest.id;
  
  // Fetch stored risks
  const risks = await getPrRisks(prId);
  
  return {
    risks: risks || [],
    prId
  };
});

/**
 * Render Jira issue panel UI
 */
resolver.define('issuePanel', async (req) => {
  const { context } = req;
  const issueKey = context.extension.issue.key;
  
  // Fetch linked PR risks from issue description or custom field
  return {
    issueKey,
    message: 'Risk details will be displayed here'
  };
});

export const handler = resolver.getDefinitions();
