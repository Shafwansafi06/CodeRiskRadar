# Rovo Quick Reference Card

## 🚀 Import & Setup

```javascript
const {
  analyzeRisk,        // Analyze code risk
  queryHistory,       // Query past incidents
  executeAction,      // Run actions (jira, pr_comment, fix_branch)
  fullWorkflow,       // Complete end-to-end workflow
  processBatch        // Batch processing
} = require('./src/rovoIntegration');
```

---

## 🤖 Agents

### RiskAnalyst

**Purpose:** Analyze code changes for security and quality issues

**Input:**
```javascript
{
  risk_score: 0.85,                    // 0.0-1.0
  top_features: [                      // Top risk indicators
    { name: 'sql_keywords', importance: 0.45 }
  ],
  diff_snippet: '+db.query(...)',      // Code changes
  file_path: 'src/auth.js',            // File location
  author: 'john.doe',                  // Author
  pr_number: '123'                     // PR number
}
```

**Output:**
```javascript
{
  explanation: 'SQL injection detected...',
  risk_level: 'critical',              // low|medium|high|critical
  actions: [
    {
      type: 'security',                // security|quality|etc
      priority: 'high',                // high|medium|low
      description: 'Use parameterized queries',
      evidence_lines: ['db.query(...)'],
      effort_estimate: '30 minutes',
      confidence: 0.95                 // 0.0-1.0
    }
  ]
}
```

**Usage:**
```javascript
const analysis = await analyzeRisk(input);
console.log(analysis.risk_level);
```

---

### Historian

**Purpose:** Find similar past incidents using embeddings

**Input:**
```javascript
{
  embedding_vector: [...],             // 768-dim vector
  code_signature: 'sql_auth',          // Identifier
  file_type: 'javascript',             // Language
  risk_area: 'authentication',         // Domain
  risk_score: 0.85                     // Current risk
}
```

**Output:**
```javascript
{
  similar_incidents: [
    {
      id: 'INC-001',
      summary: 'SQL injection in auth',
      similarity: 0.92,                // 0.0-1.0
      resolution: 'Used parameterized queries',
      link: 'https://jira.../INC-001',
      lessons: ['Always parameterize'],
      severity: 'critical'
    }
  ],
  patterns: ['SQL injection common in auth'],
  recommendations: ['Add security testing']
}
```

**Usage:**
```javascript
const history = await queryHistory(input);
console.log(history.similar_incidents.length);
```

---

## ⚡ Actions

### createJiraTask

**Purpose:** Create Jira task from analysis

**Input:**
```javascript
{
  risk_analysis: {...},                // From RiskAnalyst
  project_key: 'RISK',                 // Jira project
  priority: 'High',                    // High|Medium|Low
  confirm: false,                      // true = execute, false = preview
  metadata: {
    file_path: 'src/auth.js',
    pr_number: '123',
    author: 'john.doe',
    risk_score: 0.85
  }
}
```

**Output (preview):**
```javascript
{
  success: true,
  preview: '📋 Task Preview...',
  task_key: null,
  requires_confirmation: true
}
```

**Output (confirmed):**
```javascript
{
  success: true,
  task_key: 'RISK-1234',
  task_url: 'https://jira.../RISK-1234',
  created: true
}
```

**Usage:**
```javascript
// Preview
const preview = await executeAction('jira', input, false);
console.log(preview.preview);

// Execute
const result = await executeAction('jira', input, true);
console.log(result.task_key);
```

---

### postPRComment

**Purpose:** Post analysis as PR comment

**Input:**
```javascript
{
  risk_analysis: {...},
  pr_number: '123',
  repository: 'owner/repo',            // GitHub repo
  confirm: false,
  metadata: {
    file_path: 'src/auth.js',
    risk_score: 0.85,
    top_features: [...]
  }
}
```

**Output:**
```javascript
{
  success: true,
  comment_id: '987654321',
  comment_url: 'https://github.com/.../issuecomment-...',
  posted: true,
  updated: false                       // true if updated existing
}
```

**Usage:**
```javascript
const result = await executeAction('pr_comment', input, true);
console.log(result.comment_url);
```

---

### createFixBranchPR

**Purpose:** Create fix branch and PR

**⚠️ REQUIRES MANUAL CONFIRMATION**

**Input:**
```javascript
{
  risk_analysis: {...},
  base_branch: 'main',
  fix_description: 'Implement parameterized queries',
  repository: 'owner/repo',
  confirm: true,                       // MUST be true
  metadata: {
    original_pr: '123',
    jira_task: 'RISK-1234'
  }
}
```

**Output:**
```javascript
{
  success: true,
  branch_name: 'fix/risk-critical-...',
  pr_number: '456',
  pr_url: 'https://github.com/.../pull/456',
  created: true,
  draft: true                          // Created as draft
}
```

**Usage:**
```javascript
// MUST set confirm=true explicitly
const result = await executeAction('fix_branch', input, true);
console.log(result.pr_url);
```

---

## 🔄 Workflows

### Full Analysis + Actions

```javascript
const results = await fullWorkflow({
  // Analysis inputs
  risk_score: 0.85,
  diff_snippet: '...',
  embedding_vector: [...],
  
  // File info
  file_path: 'src/auth.js',
  pr_number: '123',
  repository: 'owner/repo',
  
  // Enable actions
  create_jira_task: true,
  post_pr_comment: true,
  
  // Action params
  project_key: 'RISK'
}, false);  // false = preview, true = execute

console.log(results.analysis.risk_level);
console.log(results.jira_task.preview);
console.log(results.pr_comment.preview);
console.log(results.errors);
```

---

### Batch Processing

```javascript
const changes = [
  { risk_score: 0.8, diff_snippet: '...', file_path: 'a.js' },
  { risk_score: 0.7, diff_snippet: '...', file_path: 'b.js' },
  { risk_score: 0.9, diff_snippet: '...', file_path: 'c.js' }
];

const results = await processBatch(changes, {
  autoExecute: false,
  createJiraTasks: true,
  postPRComments: false,
  concurrency: 3
});

console.log(`${results.results.length} succeeded`);
console.log(`${results.errors.length} failed`);
```

---

## 🎨 Formatting

### Format Risk Summary
```javascript
const { formatRiskSummary } = require('./src/rovoIntegration');
const summary = formatRiskSummary(analysis);
console.log(summary);
// 🚨 Risk Level: CRITICAL
// This change introduces...
```

### Format Historical Incidents
```javascript
const { formatIncidents } = require('./src/rovoIntegration');
const formatted = formatIncidents(history);
console.log(formatted);
// 📚 Historical Context (3 similar incidents)
// 1. 🚨 SQL injection in auth (92% similar)
```

---

## ⚙️ Configuration

### Environment Variables
```bash
# GitHub integration
export GITHUB_TOKEN=ghp_...

# Or use Forge variables
forge variables set GITHUB_TOKEN <token>
```

### Agent Timeout
```javascript
const { RiskAnalystAgent } = require('./src/rovo/riskAgent');
const agent = new RiskAnalystAgent({
  timeout: 60000,     // 60 seconds
  maxRetries: 3
});
```

### Supabase Integration
```javascript
const { HistorianAgent } = require('./src/rovo/historianAgent');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(URL, KEY);
const historian = new HistorianAgent({
  supabaseClient: supabase
});
```

---

## 🛡️ Safety Features

### Dry-Run Pattern
```javascript
// Always preview first
const preview = await executeAction('jira', input, false);
console.log(preview.preview);

// Then execute if approved
const result = await executeAction('jira', input, true);
```

### Audit Trail
```javascript
const { storage } = require('@forge/api');
const log = await storage.get('audit_log');
console.log(log);
```

---

## 🚨 Error Handling

```javascript
try {
  const analysis = await analyzeRisk(input);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Retry or fallback
  } else if (error.message.includes('rate limit')) {
    // Wait and retry
  } else {
    // Log and report
  }
}
```

---

## 📊 Prompt Variants

### Conservative (Low False Positives)
- Min confidence: 0.90
- Focus: Critical security only
- Use: Experienced teams, high velocity

### Balanced (Default)
- Min confidence: 0.75
- Focus: Security + major quality
- Use: General purpose

### Aggressive (Catch Everything)
- Min confidence: 0.50
- Focus: All potential issues
- Use: New teams, post-incident

**Switch variants:**
```javascript
const agent = new RiskAnalystAgent({
  agentKey: 'risk-analyst-conservative'  // or -aggressive
});
```

See [PROMPT_TUNING_GUIDE.md](./PROMPT_TUNING_GUIDE.md) for details.

---

## 🧪 Testing

```bash
npm test -- tests/rovo-integration.test.js
```

```javascript
const { analyzeRisk } = require('./src/rovoIntegration');

test('detects SQL injection', async () => {
  const result = await analyzeRisk({
    risk_score: 0.95,
    diff_snippet: "db.query(`SELECT * FROM users WHERE id='${id}'`)"
  });
  
  expect(result.risk_level).toBe('critical');
  expect(result.actions[0].type).toBe('security');
});
```

---

## 📚 Documentation

- **[README.md](./README.md)** - Complete guide
- **[EXAMPLES.md](./EXAMPLES.md)** - Usage examples
- **[PROMPT_TUNING_GUIDE.md](./PROMPT_TUNING_GUIDE.md)** - Tune prompts
- **[ROVO_ARCHITECTURE.md](./ROVO_ARCHITECTURE.md)** - Architecture
- **[manifest.yml.rovo](./manifest.yml.rovo)** - Manifest

---

## 🆘 Common Issues

### Agent Timeout
```javascript
// Increase timeout
const agent = new RiskAnalystAgent({ timeout: 60000 });
```

### Rate Limit
```javascript
// Add delay between calls
await new Promise(resolve => setTimeout(resolve, 1000));
```

### Missing GitHub Token
```bash
forge variables set GITHUB_TOKEN <token>
```

### Invalid Project Key
```javascript
// Must match format: PROJ, RISK, etc (uppercase, 2-10 chars)
project_key: 'RISK'  ✅
project_key: 'risk'  ❌
```

---

## 📈 Performance

| Operation | Typical Time |
|-----------|-------------|
| Risk Analysis | 2-5 seconds |
| History Query | 1-3 seconds |
| Jira Task | 1-2 seconds |
| PR Comment | 1-2 seconds |
| Batch (3 files) | 3-6 seconds |

---

**Quick start:** Copy examples from [EXAMPLES.md](./EXAMPLES.md)

**Need help?** See [README.md](./README.md) or open an issue
