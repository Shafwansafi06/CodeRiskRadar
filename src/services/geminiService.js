import { ObservAIClient } from '@observai/sdk';

/**
 * Gemini AI Service for PR Remediation
 * Powered by ObservAI for tracking, cost analysis, and quality metrics
 */

const apiKey = process.env.GEMINI_API_KEY;
// Using Supabase URL from environment context
const trackingEndpoint = 'https://nztdwsnmttwwjticuphi.supabase.co/functions/v1/track-llm';
const projectId = 'pitstop-ai-forge';
const userId = '1bd4c817-2638-495d-be3a-4809b3e648ea'; // User provided UUID
const batchMode = true;

// Initialize ObservAI Client
let client = null;
try {
  if (apiKey) {
    client = new ObservAIClient({
      apiKey,
      projectId,
      userId,
      trackingEndpoint,
      batchMode // Efficient batch tracking
    });
    console.log('✅ ObservAI Client initialized');
  }
} catch (e) {
  console.error('Failed to initialize ObservAI client:', e);
}

/**
 * Generate AI-powered remediation suggestions
 */
export async function generateRemediations(prData, riskAnalysis) {
  console.log('🤖 Generating AI remediation suggestions (ObservAI)...');

  if (!apiKey) {
    console.error('❌ Missing GEMINI_API_KEY environment variable');
    return {
      success: false,
      error: 'API Key missing',
      suggestions: getFallbackSuggestions(riskAnalysis)
    };
  }

  if (!client) {
    console.error('❌ ObservAI client not initialized');
    return {
      success: false,
      error: 'SDK initialization failed',
      suggestions: getFallbackSuggestions(riskAnalysis)
    };
  }

  try {
    const prompt = buildRemediationPrompt(prData, riskAnalysis);

    console.log(`📡 Calling Gemini API via ObservAI...`);

    const modelName = 'gemini-2.0-flash-exp';
    console.log(`--- DEBUG: USING MODEL: ${modelName} ---`);

    // ObservAI wrapper call
    const result = await client.generateContent(
      modelName, // Updated and logged for diagnostics
      prompt,
      {
        metadata: {
          feature: 'pr_remediation',
          prId: prData.prId || 'unknown'
        }
      }
    );

    if (!result || !result.response) {
      console.error('❌ Empty response from ObservAI');
      throw new Error('No suggestions generated');
    }

    // Access text safely depending on SDK version (function or property)
    let aiText = '';

    if (typeof result.response.text === 'function') {
      aiText = result.response.text();
    } else {
      aiText = result.response.text || '';
    }

    // Log ObservAI metrics
    if (result.tracking) {
      console.log('📊 ObservAI Stats:', {
        cost: result.tracking.cost_usd,
        quality: result.tracking.coherence_score,
        latency: result.tracking.latency_ms
      });
    }

    const suggestions = parseAISuggestions(aiText);

    console.log(`✅ Generated ${suggestions.length} AI suggestions`);

    return {
      success: true,
      suggestions
    };

  } catch (error) {
    console.error('❌ ObservAI Exception:', error);
    if (error.response) {
      console.error('Error Response:', JSON.stringify(error.response, null, 2));
    }
    return {
      success: false,
      error: error.message,
      suggestions: getFallbackSuggestions(riskAnalysis)
    };
  }
}

/**
 * Build context-aware prompt for Gemini
 */
function buildRemediationPrompt(prData, riskAnalysis) {
  const riskFactors = riskAnalysis.risk_factors || [];
  const topRisks = riskFactors.slice(0, 5);

  return `You are a senior code reviewer for a Formula 1 racing team's software engineering department. Analyze this pull request and provide SPECIFIC, ACTIONABLE remediation steps.

**PR Context:**
- Title: ${prData.title}
- Files Changed: ${prData.filesChanged?.length || 0}
- Lines Added: ${prData.additions || 0}
- Lines Deleted: ${prData.deletions || 0}
- Risk Score: ${riskAnalysis.risk_score}/100

**Identified Risk Factors:**
${topRisks.map((r, i) => `${i + 1}. ${r.factor} (${r.percentage}% impact) - ${r.description}`).join('\n')}

**Your Task:**
Provide exactly 3 remediation steps that the developer can implement RIGHT NOW to reduce risk. Each step must:
1. Be specific and actionable (not generic advice)
2. Include estimated time to complete
3. Explain WHY it reduces risk

**Format your response as:**
STEP 1: [Action]
TIME: [Estimate]
WHY: [Risk reduction explanation]

STEP 2: [Action]
TIME: [Estimate]
WHY: [Risk reduction explanation]

STEP 3: [Action]
TIME: [Estimate]
WHY: [Risk reduction explanation]

Focus on practical steps like: splitting the PR, adding tests, requesting specific reviews, or improving documentation.`;
}

/**
 * Parse AI response into structured suggestions
 */
function parseAISuggestions(aiText) {
  if (!aiText) return [];

  const suggestions = [];
  const stepRegex = /STEP (\d+):\s*(.+?)\nTIME:\s*(.+?)\nWHY:\s*(.+?)(?=\n\nSTEP|\n*$)/gs;

  let match;
  while ((match = stepRegex.exec(aiText)) !== null) {
    suggestions.push({
      step: parseInt(match[1]),
      action: match[2].trim(),
      timeEstimate: match[3].trim(),
      reasoning: match[4].trim(),
      source: 'gemini-ai'
    });
  }

  // Fallback parsing if regex fails
  if (suggestions.length === 0) {
    const lines = aiText.split('\n').filter(l => l.trim());
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      suggestions.push({
        step: i + 1,
        action: lines[i],
        timeEstimate: '15-30 minutes',
        reasoning: 'Reduces overall PR risk',
        source: 'gemini-ai-fallback'
      });
    }
  }

  return suggestions;
}

/**
 * Fallback suggestions if AI fails
 */
function getFallbackSuggestions(riskAnalysis) {
  const score = riskAnalysis.risk_score;
  const suggestions = [];

  if (score > 70) {
    suggestions.push({
      step: 1,
      action: 'Split this PR into smaller, focused changes',
      timeEstimate: '30-60 minutes',
      reasoning: 'Large PRs have 3x higher failure rate in production',
      source: 'fallback'
    });
  }

  suggestions.push({
    step: suggestions.length + 1,
    action: 'Request review from a senior team member',
    timeEstimate: '5 minutes',
    reasoning: 'High-risk PRs benefit from experienced oversight',
    source: 'fallback'
  });

  suggestions.push({
    step: suggestions.length + 1,
    action: 'Add integration tests covering the main changes',
    timeEstimate: '45-90 minutes',
    reasoning: 'Tests reduce production incidents by 67%',
    source: 'fallback'
  });

  return suggestions;
}

export default {
  generateRemediations
};
