import Resolver from '@forge/resolver';
import { getPrRisks } from './storage';
import { generateDryRunPreview } from './dryRunService';
import { storeApprovalRequest, updateApprovalStatus } from './storage';
import OpenAI from 'openai';

const resolver = new Resolver();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Rovo Action: Explain Risk
 * Provides detailed explanation of a specific code risk
 */
resolver.define('explainRisk', async ({ payload }) => {
  const { riskId, prId } = payload;
  
  try {
    const risks = await getPrRisks(prId);
    const risk = risks.find(r => r.id === riskId);
    
    if (!risk) {
      return {
        success: false,
        message: 'Risk not found'
      };
    }
    
    // Generate detailed explanation using LLM
    const prompt = `Explain this code risk in detail for a developer:

Risk Type: ${risk.name}
Category: ${risk.category}
Severity: ${risk.severity}
Description: ${risk.description}
Code Snippet: ${risk.snippet}

Provide:
1. Why this is risky (technical explanation)
2. Real-world attack scenarios or impacts
3. Best practices to avoid this in the future
4. References to security standards (OWASP, CWE, etc.) if applicable`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a security expert educator.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });
    
    const explanation = response.choices[0].message.content;
    
    return {
      success: true,
      risk,
      explanation,
      references: extractReferences(explanation)
    };
    
  } catch (error) {
    console.error('Explain risk error:', error);
    return {
      success: false,
      message: 'Failed to generate explanation',
      error: error.message
    };
  }
});

/**
 * Rovo Action: Suggest Fix
 * Generates code suggestions to fix identified risk
 */
resolver.define('suggestFix', async ({ payload }) => {
  const { riskId, prId } = payload;
  
  try {
    const risks = await getPrRisks(prId);
    const risk = risks.find(r => r.id === riskId);
    
    if (!risk) {
      return {
        success: false,
        message: 'Risk not found'
      };
    }
    
    // Generate fix using LLM
    const prompt = `Generate a secure code fix for this vulnerability:

Risk: ${risk.name}
Current Code:
\`\`\`
${risk.snippet}
\`\`\`

Provide:
1. Fixed code snippet
2. Explanation of the changes
3. Additional security measures to consider

Format your response as:
FIXED CODE:
\`\`\`
[fixed code here]
\`\`\`

EXPLANATION:
[explanation here]

ADDITIONAL MEASURES:
[additional recommendations]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a secure coding expert.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });
    
    const fixContent = response.choices[0].message.content;
    const fixedCode = extractCodeBlock(fixContent);
    
    return {
      success: true,
      risk,
      fixedCode,
      fullResponse: fixContent,
      requiresApproval: true
    };
    
  } catch (error) {
    console.error('Suggest fix error:', error);
    return {
      success: false,
      message: 'Failed to generate fix suggestion',
      error: error.message
    };
  }
});

/**
 * Rovo Action: Approve Fix
 * Approves and applies a suggested fix with user confirmation
 */
resolver.define('approveFix', async ({ payload, context }) => {
  const { riskId, prId, fixedCode, action } = payload;
  const userId = context.accountId;
  
  try {
    if (action === 'preview') {
      // Generate dry-run preview
      const preview = await generateDryRunPreview('COMMIT_FIX', {
        prId,
        riskId,
        fixedCode,
        fileName: 'Updated via Code Risk Radar',
        commitMessage: `Fix: ${riskId}`,
        diff: generateDiff(payload.originalCode, fixedCode)
      });
      
      return {
        success: true,
        preview,
        requiresConfirmation: true
      };
    }
    
    if (action === 'confirm') {
      // Store approval request
      const approvalId = await storeApprovalRequest({
        type: 'COMMIT_FIX',
        payload: {
          prId,
          riskId,
          fixedCode
        },
        userId,
        status: 'PENDING'
      });
      
      // Update to approved
      await updateApprovalStatus(approvalId, 'APPROVED', userId);
      
      // In production, this would commit the fix to the PR
      // For MVP, we'll just return success
      
      return {
        success: true,
        message: 'Fix approved. In production, this would commit the changes to the PR.',
        approvalId
      };
    }
    
    return {
      success: false,
      message: 'Invalid action. Use "preview" or "confirm".'
    };
    
  } catch (error) {
    console.error('Approve fix error:', error);
    return {
      success: false,
      message: 'Failed to process fix approval',
      error: error.message
    };
  }
});

/**
 * Extract code block from markdown response
 */
function extractCodeBlock(text) {
  const match = text.match(/```[\w]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : text;
}

/**
 * Extract references (URLs, standards) from text
 */
function extractReferences(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];
  
  const standardRegex = /(OWASP|CWE|CVE)[-\s]?(\d+)/gi;
  const standards = text.match(standardRegex) || [];
  
  return {
    urls,
    standards
  };
}

/**
 * Generate simple diff between original and fixed code
 */
function generateDiff(original, fixed) {
  return `--- Original
+++ Fixed
-${original}
+${fixed}`;
}

export const handler = resolver.getDefinitions();
