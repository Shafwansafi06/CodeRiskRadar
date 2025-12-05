import OpenAI from 'openai';

// Initialize OpenAI client (API key should be stored in Forge environment variables)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Risk patterns to detect via regex
 */
const RISK_PATTERNS = [
  {
    id: 'sql-injection',
    name: 'SQL Injection Risk',
    pattern: /(?:execute|exec|query)\s*\(\s*["'`].*?\+.*?["'`]/gi,
    severity: 'HIGH',
    category: 'SECURITY',
    description: 'Detected string concatenation in SQL query which may lead to SQL injection'
  },
  {
    id: 'hardcoded-secret',
    name: 'Hardcoded Secret',
    pattern: /(?:password|secret|api[_-]?key|token)\s*=\s*["'][^"']{8,}["']/gi,
    severity: 'HIGH',
    category: 'SECURITY',
    description: 'Hardcoded credentials or secrets detected in code'
  },
  {
    id: 'console-log',
    name: 'Debug Statement',
    pattern: /console\.(log|debug|info)\s*\(/gi,
    severity: 'LOW',
    category: 'QUALITY',
    description: 'Console statements should be removed before production'
  },
  {
    id: 'todo-comment',
    name: 'TODO Comment',
    pattern: /\/\/\s*TODO:|#\s*TODO:/gi,
    severity: 'LOW',
    category: 'QUALITY',
    description: 'TODO comment indicates incomplete work'
  },
  {
    id: 'eval-usage',
    name: 'Eval Usage',
    pattern: /\beval\s*\(/gi,
    severity: 'HIGH',
    category: 'SECURITY',
    description: 'eval() is dangerous and should be avoided'
  }
];

/**
 * Analyze code diff for security and quality risks
 */
export async function analyzeRisks(diffText, context = {}) {
  const risks = [];
  let callCount = 0;
  const MAX_LLM_CALLS = 10; // Rate limiting
  
  // Phase 1: Regex-based pattern matching
  for (const pattern of RISK_PATTERNS) {
    const matches = diffText.match(pattern.pattern);
    if (matches) {
      for (const match of matches) {
        risks.push({
          id: `${pattern.id}-${risks.length}`,
          type: pattern.id,
          name: pattern.name,
          severity: pattern.severity,
          category: pattern.category,
          description: pattern.description,
          snippet: match,
          lineNumber: findLineNumber(diffText, match),
          detectionMethod: 'REGEX'
        });
      }
    }
  }
  
  // Phase 2: LLM-based deep analysis (only if regex found risks or for complex patterns)
  if (risks.length > 0 && callCount < MAX_LLM_CALLS) {
    try {
      const enhancedRisks = await enhanceRisksWithLLM(diffText, risks);
      callCount++;
      
      // Merge LLM insights
      risks.forEach((risk, index) => {
        if (enhancedRisks[index]) {
          risk.llmInsight = enhancedRisks[index].insight;
          risk.suggestedFix = enhancedRisks[index].fix;
        }
      });
    } catch (error) {
      console.error('LLM analysis failed:', error);
      // Continue with regex-only results
    }
  }
  
  // Phase 3: Score risks by business impact (using historical data if available)
  const scoredRisks = await scoreRisksByImpact(risks, context);
  
  return scoredRisks;
}

/**
 * Enhance risk analysis using LLM
 */
async function enhanceRisksWithLLM(diffText, risks) {
  const prompt = `You are a security expert. Analyze these code risks and provide:
1. Detailed explanation of why each is risky
2. Suggested fix for each

Code diff:
\`\`\`
${diffText.substring(0, 3000)} // Truncate to avoid token limits
\`\`\`

Detected risks:
${risks.map(r => `- ${r.name}: ${r.snippet}`).join('\n')}

Respond in JSON format:
[
  {
    "riskId": "risk-id",
    "insight": "detailed explanation",
    "fix": "suggested code fix"
  }
]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: 'You are a code security analyst.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 2000
  });
  
  const content = response.choices[0].message.content;
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  return [];
}

/**
 * Score risks by business impact using historical data
 */
async function scoreRisksByImpact(risks, context) {
  // TODO: Integrate with vector search to find similar past incidents
  // For MVP, use simple severity-based scoring
  
  return risks.map(risk => ({
    ...risk,
    impactScore: calculateImpactScore(risk),
    priority: calculatePriority(risk)
  }));
}

/**
 * Calculate impact score (0-100)
 */
function calculateImpactScore(risk) {
  const severityScores = {
    'HIGH': 80,
    'MEDIUM': 50,
    'LOW': 20
  };
  
  const categoryMultiplier = {
    'SECURITY': 1.2,
    'QUALITY': 0.8,
    'PERFORMANCE': 1.0
  };
  
  const baseScore = severityScores[risk.severity] || 50;
  const multiplier = categoryMultiplier[risk.category] || 1.0;
  
  return Math.min(100, Math.round(baseScore * multiplier));
}

/**
 * Calculate priority (CRITICAL, HIGH, MEDIUM, LOW)
 */
function calculatePriority(risk) {
  if (risk.impactScore >= 80) return 'CRITICAL';
  if (risk.impactScore >= 60) return 'HIGH';
  if (risk.impactScore >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Find line number of a match in diff
 */
function findLineNumber(diffText, match) {
  const lines = diffText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) {
      return i + 1;
    }
  }
  return null;
}
