# Rovo Integration for Code Risk Radar

Production-ready Atlassian Rovo agent and action system for intelligent code risk analysis and automated remediation workflows.

## 🎯 Overview

This module provides two intelligent Rovo agents and three automated actions that work together to identify, analyze, and remediate code security and quality issues.

### Agents

1. **RiskAnalyst** - Analyzes code changes using ML risk scores and provides actionable recommendations
2. **Historian** - Queries past incidents and learns from historical patterns using embeddings

### Actions

1. **createJiraTask** - Creates Jira tasks from risk analysis (dry-run with preview)
2. **postPRComment** - Posts formatted risk analysis as PR comments (dry-run with preview)
3. **createFixBranchPR** - Creates fix branches and PRs (manual confirmation required)

## 📦 Installation

### 1. Install Dependencies

```bash
npm install @forge/api node-fetch
```

### 2. Configure Manifest

Add the Rovo definitions from `manifest.yml.rovo` to your Forge `manifest.yml`:

```yaml
# Copy the modules section from manifest.yml.rovo
```

### 3. Set Up Credentials

```bash
# For GitHub integration
forge variables set GITHUB_TOKEN <your-github-token>

# Or store in Forge storage via API
```

### 4. Deploy

```bash
forge deploy
forge install
```

## 🚀 Quick Start

### Basic Risk Analysis

```javascript
const { analyzeRisk } = require('./src/rovoIntegration');

const analysis = await analyzeRisk({
  risk_score: 0.85,
  top_features: [
    { name: 'sql_keywords', importance: 0.45 },
    { name: 'user_input', importance: 0.32 }
  ],
  diff_snippet: "+db.query(`SELECT * FROM users WHERE id='${userId}'`);",
  file_path: 'src/auth.js',
  pr_number: '123'
});

console.log(analysis.risk_level); // 'critical'
console.log(analysis.actions.length); // 2
```

### Full Workflow

```javascript
const { fullWorkflow } = require('./src/rovoIntegration');

const results = await fullWorkflow({
  risk_score: 0.85,
  diff_snippet: '...',
  embedding_vector: [...],
  file_path: 'src/auth.js',
  pr_number: '123',
  repository: 'company/repo',
  
  // Enable actions
  create_jira_task: true,
  post_pr_comment: true,
  
  // Parameters
  project_key: 'RISK'
}, false); // false = preview mode

// View previews
console.log(results.jira_task.preview);
console.log(results.pr_comment.preview);

// Execute if approved
// ... set confirm: true and re-run
```

## 📖 Documentation

- **[ROVO_ARCHITECTURE.md](./ROVO_ARCHITECTURE.md)** - System architecture overview
- **[EXAMPLES.md](./EXAMPLES.md)** - Comprehensive usage examples
- **[PROMPT_TUNING_GUIDE.md](./PROMPT_TUNING_GUIDE.md)** - How to tune agent prompts
- **[manifest.yml.rovo](./manifest.yml.rovo)** - Complete manifest definitions

## 🔧 Configuration

### Agent Variants

Choose between Conservative, Balanced (default), or Aggressive modes:

```javascript
const { RiskAnalystAgent } = require('./src/rovo/riskAgent');

// Conservative mode (low false positives)
const conservativeAgent = new RiskAnalystAgent({
  agentKey: 'risk-analyst-conservative',
  timeout: 30000
});

// Aggressive mode (catch everything)
const aggressiveAgent = new RiskAnalystAgent({
  agentKey: 'risk-analyst-aggressive',
  timeout: 30000
});
```

See [PROMPT_TUNING_GUIDE.md](./PROMPT_TUNING_GUIDE.md) for detailed tuning strategies.

### Supabase Integration (Optional)

For direct embedding queries:

```javascript
const { createClient } = require('@supabase/supabase-js');
const { HistorianAgent } = require('./src/rovo/historianAgent');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const historian = new HistorianAgent({
  supabaseClient: supabase
});
```

## 🛡️ Safety Features

### Dry-Run Pattern

All write operations return previews first:

```javascript
// Preview (confirm=false)
const preview = await executeAction('jira', {
  risk_analysis: analysis,
  project_key: 'RISK',
  confirm: false // <-- Preview only
});

console.log(preview.preview);
console.log(preview.requires_confirmation); // true

// Execute (confirm=true)
const result = await executeAction('jira', {
  risk_analysis: analysis,
  project_key: 'RISK',
  confirm: true // <-- Actually execute
});

console.log(result.task_key); // 'RISK-1234'
```

### Manual Confirmation

The `createFixBranchPR` action ALWAYS requires explicit confirmation:

```javascript
// This will fail validation
await executeAction('fix_branch', {
  ...,
  confirm: false
});

// Must be explicitly true
await executeAction('fix_branch', {
  ...,
  confirm: true // <-- REQUIRED
});
```

### Audit Logging

All actions are automatically logged:

```javascript
const { storage } = require('@forge/api');

const auditLog = await storage.get('audit_log');
console.log(auditLog);
// [
//   {
//     action: 'create_jira_task',
//     task_key: 'RISK-1234',
//     risk_level: 'critical',
//     timestamp: '2025-12-05T...',
//     user: 'system'
//   },
//   ...
// ]
```

## 🎨 Output Examples

### Risk Analysis Output

```json
{
  "explanation": "This change introduces a critical SQL injection vulnerability by directly interpolating user input into a database query. Additionally, no input validation is present.",
  "risk_level": "critical",
  "actions": [
    {
      "type": "security",
      "priority": "high",
      "description": "Use parameterized queries to prevent SQL injection",
      "evidence_lines": ["db.query(`SELECT * FROM users WHERE name='${username}'`)"],
      "effort_estimate": "30 minutes",
      "confidence": 0.95
    },
    {
      "type": "security",
      "priority": "high",
      "description": "Add input validation for username parameter",
      "evidence_lines": ["const username = req.body.username;"],
      "effort_estimate": "45 minutes",
      "confidence": 0.85
    }
  ]
}
```

### Historical Context Output

```json
{
  "similar_incidents": [
    {
      "id": "INC-2023-045",
      "summary": "SQL injection in user authentication endpoint",
      "similarity": 0.92,
      "resolution": "Implemented parameterized queries and input validation",
      "link": "https://jira.company.com/browse/INC-2023-045",
      "lessons": [
        "Always use parameterized queries",
        "Add input validation layer"
      ],
      "occurred_at": "2023-08-15T10:30:00Z",
      "severity": "critical"
    }
  ],
  "patterns": [
    "SQL injection vulnerabilities often occur in authentication code",
    "Direct string concatenation in queries is a common root cause"
  ],
  "recommendations": [
    "Implement automated SQL injection testing in CI/CD pipeline",
    "Consider using an ORM to reduce direct SQL query writing"
  ]
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run specific test suite
npm test -- tests/rovo.test.js

# Run with coverage
npm test -- --coverage
```

Example test:

```javascript
const { analyzeRisk } = require('./src/rovoIntegration');

test('detects SQL injection', async () => {
  const result = await analyzeRisk({
    risk_score: 0.95,
    diff_snippet: "db.query(`SELECT * FROM users WHERE id='${userId}'`)",
    file_path: 'test.js'
  });
  
  expect(result.risk_level).toBe('critical');
  expect(result.actions[0].type).toBe('security');
});
```

## 📊 Integration Patterns

### GitHub Webhook

```javascript
app.post('/webhook/github', async (req, res) => {
  const pr = req.body.pull_request;
  
  if (pr) {
    await fullWorkflow({
      risk_score: await calculateRisk(pr),
      pr_number: pr.number,
      repository: req.body.repository.full_name,
      post_pr_comment: true
    }, true);
  }
  
  res.status(200).send('OK');
});
```

### Batch Processing

```javascript
const { processBatch } = require('./src/rovoIntegration');

const results = await processBatch(fileChanges, {
  autoExecute: false,
  createJiraTasks: true,
  postPRComments: false,
  concurrency: 3
});

console.log(`Processed ${results.results.length} files`);
```

### CI/CD Integration

```yaml
# .github/workflows/risk-analysis.yml
name: Risk Analysis
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Risk Analysis
        run: |
          node scripts/analyze-pr.js ${{ github.event.pull_request.number }}
```

## 🔒 Security Considerations

1. **GitHub Token**: Store securely in Forge variables or secrets
2. **Rate Limiting**: Built-in retry logic with exponential backoff
3. **Input Validation**: All inputs are validated and sanitized
4. **Audit Trail**: All actions logged to Forge storage
5. **Dry-Run First**: Preview before executing any write operations
6. **Manual Confirmation**: Critical actions require explicit approval

## 🐛 Troubleshooting

### Agent Timeout

```javascript
// Increase timeout
const agent = new RiskAnalystAgent({
  timeout: 60000, // 60 seconds
  maxRetries: 3
});
```

### GitHub API Rate Limit

```javascript
// Check remaining rate limit
const response = await fetch('https://api.github.com/rate_limit', {
  headers: { 'Authorization': `token ${token}` }
});
const data = await response.json();
console.log('Remaining:', data.rate.remaining);
```

### Missing Embeddings

```javascript
// Gracefully handle missing embeddings
const input = {
  risk_score: 0.85,
  diff_snippet: '...',
  // embedding_vector: undefined // OK, will skip history
};

const results = await performFullAnalysis(input);
// results.historical_context will be null
```

## 📈 Performance

- **Risk Analysis**: ~2-5 seconds per file
- **History Query**: ~1-3 seconds (with embeddings)
- **Jira Task Creation**: ~1-2 seconds
- **PR Comment**: ~1-2 seconds
- **Batch Processing**: 3 files per second (concurrency=3)

## 🤝 Contributing

See the main project README for contribution guidelines.

## 📝 License

Same as main Code Risk Radar project.

## 🆘 Support

- **Documentation**: See `/rovo` folder
- **Examples**: See `EXAMPLES.md`
- **Issues**: GitHub issues
- **Questions**: Discussions tab

---

**Built with ❤️ for Code Risk Radar**
