import Resolver from '@forge/resolver';
import { getPrRisks } from './storage';
import OpenAI from 'openai';

const resolver = new Resolver();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Rovo Agent handler for conversational risk exploration
 */
resolver.define('handler', async ({ payload, context }) => {
  const { message, conversationHistory } = payload;
  
  try {
    // Extract PR ID from message if mentioned
    const prIdMatch = message.match(/PR[#\s-]*(\d+)/i);
    let prRisks = [];
    
    if (prIdMatch) {
      const prId = prIdMatch[1];
      prRisks = await getPrRisks(prId);
    }
    
    // Build context for LLM
    const systemPrompt = `You are Code Risk Radar, an expert code security and quality assistant.
You analyze pull requests for security vulnerabilities, anti-patterns, and quality issues.
You have access to risk analysis data and can provide insights, explanations, and recommendations.

When discussing risks, always:
1. Explain WHY it's risky
2. Describe the potential IMPACT
3. Suggest specific FIXES
4. Prioritize by business impact, not just severity

Be concise but thorough. Use technical language when appropriate.`;

    const userContext = prRisks.length > 0 
      ? `\n\nCurrent PR Risks:\n${JSON.stringify(prRisks, null, 2)}`
      : '';
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: message + userContext }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });
    
    const reply = response.choices[0].message.content;
    
    return {
      message: reply,
      suggestedActions: generateSuggestedActions(prRisks)
    };
    
  } catch (error) {
    console.error('Rovo agent error:', error);
    return {
      message: 'Sorry, I encountered an error analyzing that request. Please try again.',
      error: error.message
    };
  }
});

/**
 * Generate suggested Rovo actions based on current context
 */
function generateSuggestedActions(risks) {
  const actions = [];
  
  if (risks.length > 0) {
    const highSeverityRisks = risks.filter(r => r.severity === 'HIGH');
    
    if (highSeverityRisks.length > 0) {
      actions.push({
        action: 'explainRisk',
        label: `Explain ${highSeverityRisks[0].name}`,
        params: { riskId: highSeverityRisks[0].id }
      });
      
      if (highSeverityRisks[0].suggestedFix) {
        actions.push({
          action: 'suggestFix',
          label: 'Show suggested fix',
          params: { riskId: highSeverityRisks[0].id }
        });
      }
    }
  }
  
  return actions;
}

export const handler = resolver.getDefinitions();
