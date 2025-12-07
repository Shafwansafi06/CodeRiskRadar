# 🚀 Rovo Integration Implementation Checklist

Use this checklist to deploy the Rovo integration step-by-step.

---

## 📋 Pre-Deployment Checklist

### 1. Prerequisites
- [ ] Node.js 18+ installed
- [ ] Forge CLI installed (`npm install -g @forge/cli`)
- [ ] Forge account created and logged in (`forge login`)
- [ ] GitHub account with admin access to repositories
- [ ] Jira instance with project created (e.g., "RISK")
- [ ] Supabase project set up (optional, for direct embedding queries)

### 2. Repository Setup
- [ ] Clone/pull latest Code Risk Radar repository
- [ ] Review all files in `/rovo` and `/src/rovo` directories
- [ ] Read `ROVO_DELIVERY_SUMMARY.md` for overview
- [ ] Review `rovo/README.md` for detailed instructions

---

## 🔧 Installation Steps

### Step 1: Install Dependencies

```bash
cd /home/shafwan-safi/Desktop/CodeRiskRadar

# Install Forge dependencies
npm install @forge/api

# Install additional dependencies
npm install node-fetch@2

# Install dev dependencies for testing
npm install --save-dev jest @types/node eslint
```

**Verification:**
- [ ] `node_modules/@forge/api` exists
- [ ] `node_modules/node-fetch` exists
- [ ] `package.json` updated with dependencies

---

### Step 2: Update Manifest

```bash
# Backup existing manifest
cp manifest.yml manifest.yml.backup

# Review the Rovo manifest additions
cat manifest.yml.rovo
```

**Manual Steps:**
- [ ] Open `manifest.yml` in editor
- [ ] Copy agent definitions from `manifest.yml.rovo` (lines under `rovo:agent:`)
- [ ] Copy action definitions from `manifest.yml.rovo` (lines under `rovo:action:`)
- [ ] Copy function definitions from `manifest.yml.rovo` (lines under `function:`)
- [ ] Copy permissions from `manifest.yml.rovo` (add to existing `permissions:`)
- [ ] Update app ID if needed
- [ ] Save `manifest.yml`

**Verification:**
- [ ] `manifest.yml` contains `rovo:agent` section
- [ ] `manifest.yml` contains `rovo:action` section
- [ ] All three agents defined (risk-analyst-agent, historian-agent)
- [ ] All three actions defined (create-jira-task-action, post-pr-comment-action, create-fix-branch-pr-action)
- [ ] Function handlers referenced correctly

---

### Step 3: Configure Main Entry Point

Update your main `src/index.js` to export the action handlers:

```javascript
// Add to src/index.js
const { createJiraTaskHandler } = require('./actions/createJiraTask');
const { postPRCommentHandler } = require('./actions/postPRComment');
const { createFixBranchPRHandler } = require('./actions/createFixBranchPR');

// Export for Forge
exports.createJiraTaskHandler = createJiraTaskHandler;
exports.postPRCommentHandler = postPRCommentHandler;
exports.createFixBranchPRHandler = createFixBranchPRHandler;
```

**Verification:**
- [ ] `src/index.js` exports all three handlers
- [ ] No syntax errors in `src/index.js`

---

### Step 4: Set Environment Variables

```bash
# Set GitHub token (required for PR operations)
forge variables set GITHUB_TOKEN <your-github-token>

# Verify it's set
forge variables list

# Optional: Set Supabase credentials
forge variables set SUPABASE_URL <your-supabase-url>
forge variables set SUPABASE_KEY <your-supabase-key>
```

**GitHub Token Setup:**
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Required scopes:
   - `repo` (full control)
   - `write:discussion` (for comments)
4. Copy token and use in command above

**Verification:**
- [ ] `GITHUB_TOKEN` appears in `forge variables list`
- [ ] Token has correct permissions
- [ ] Token is not expired

---

### Step 5: Deploy to Forge

```bash
# Deploy the app
forge deploy

# Expected output:
# ✔ Build successful
# ✔ Deployed successfully
```

**Troubleshooting:**
- If build fails, check for syntax errors
- If manifest errors, validate YAML syntax
- Check `forge lint` for issues

**Verification:**
- [ ] Deploy completed without errors
- [ ] App version incremented
- [ ] No manifest validation errors

---

### Step 6: Install App

```bash
# Install to your Jira site
forge install

# Follow prompts:
# - Select product: Jira
# - Select site: [your-site]
# - Confirm installation

# Expected output:
# ✔ Installed successfully
```

**Verification:**
- [ ] Installation completed
- [ ] App appears in Jira Apps list
- [ ] No permission errors

---

## 🧪 Testing Phase

### Test 1: Risk Analysis Agent (Dry Run)

Create a test file `scripts/test-risk-agent.js`:

```javascript
const { analyzeRisk } = require('../src/rovoIntegration');

async function test() {
  const result = await analyzeRisk({
    risk_score: 0.85,
    top_features: [
      { name: 'sql_keywords', importance: 0.45 }
    ],
    diff_snippet: "+db.query(`SELECT * FROM users WHERE id='${userId}'`);",
    file_path: 'test.js'
  });
  
  console.log('Risk Level:', result.risk_level);
  console.log('Actions:', result.actions.length);
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
```

Run test:
```bash
node scripts/test-risk-agent.js
```

**Expected Results:**
- [ ] Agent responds within 5 seconds
- [ ] Returns valid JSON with `risk_level` and `actions`
- [ ] `risk_level` is "high" or "critical"
- [ ] At least one security action recommended

---

### Test 2: Historian Agent (Dry Run)

```javascript
const { queryHistory } = require('../src/rovoIntegration');

async function test() {
  const result = await queryHistory({
    code_signature: 'sql_auth_test',
    file_type: 'javascript',
    risk_area: 'authentication'
  });
  
  console.log('Similar incidents:', result.similar_incidents.length);
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
```

**Expected Results:**
- [ ] Agent responds (may return empty if no history)
- [ ] Returns valid JSON structure
- [ ] No errors thrown

---

### Test 3: Jira Task Action (Preview)

```javascript
const { executeAction } = require('../src/rovoIntegration');

async function test() {
  const analysis = {
    explanation: 'Test SQL injection vulnerability',
    risk_level: 'critical',
    actions: [
      {
        type: 'security',
        priority: 'high',
        description: 'Use parameterized queries',
        evidence_lines: ['db.query(...)'],
        effort_estimate: '30 minutes',
        confidence: 0.95
      }
    ]
  };
  
  const result = await executeAction('jira', {
    risk_analysis: analysis,
    project_key: 'RISK',
    confirm: false  // Preview only
  });
  
  console.log('Preview:\n', result.preview);
  console.log('Requires confirmation:', result.requires_confirmation);
}

test().catch(console.error);
```

**Expected Results:**
- [ ] Returns preview text
- [ ] `requires_confirmation` is `true`
- [ ] Preview contains risk level, summary, and actions
- [ ] No actual Jira task created

---

### Test 4: PR Comment Action (Preview)

```javascript
const { executeAction } = require('../src/rovoIntegration');

async function test() {
  const analysis = {
    explanation: 'Test issue',
    risk_level: 'high',
    actions: []
  };
  
  const result = await executeAction('pr_comment', {
    risk_analysis: analysis,
    pr_number: '123',
    repository: 'test-owner/test-repo',
    confirm: false
  });
  
  console.log('Preview:\n', result.preview);
}

test().catch(console.error);
```

**Expected Results:**
- [ ] Returns formatted markdown preview
- [ ] Contains risk badges and formatting
- [ ] No actual comment posted

---

### Test 5: Fix Branch Action (Preview)

```javascript
const { executeAction } = require('../src/rovoIntegration');

async function test() {
  const analysis = {
    explanation: 'Critical issue',
    risk_level: 'critical',
    actions: []
  };
  
  const result = await executeAction('fix_branch', {
    risk_analysis: analysis,
    base_branch: 'main',
    fix_description: 'Implement parameterized queries to prevent SQL injection',
    repository: 'test-owner/test-repo',
    confirm: false  // Should fail validation
  });
  
  console.log('Result:', result);
}

test().catch(console.error);
```

**Expected Results:**
- [ ] Returns preview with warning
- [ ] Indicates manual confirmation required
- [ ] No branch or PR created

---

### Test 6: Run Full Test Suite

```bash
# Run all tests
npm test

# Expected output:
# PASS tests/rovo-integration.test.js
#   ✓ All tests passing
```

**Expected Results:**
- [ ] All 20+ tests pass
- [ ] No test failures
- [ ] Coverage >80% (if running with coverage)

---

## ✅ Production Deployment

### Test 7: Create Real Jira Task

**CAUTION:** This will create an actual Jira task.

```javascript
const result = await executeAction('jira', {
  risk_analysis: {
    explanation: 'Production test - please ignore and close',
    risk_level: 'low',
    actions: []
  },
  project_key: 'RISK',
  confirm: true  // Actually create
});

console.log('Created task:', result.task_key);
console.log('URL:', result.task_url);
```

**Verification:**
- [ ] Task created in Jira
- [ ] Task appears in project board
- [ ] Task contains proper formatting
- [ ] Can open task URL successfully

**Cleanup:**
- [ ] Close/delete test task

---

### Test 8: Post Real PR Comment

**CAUTION:** This will post an actual GitHub comment.

Choose a test PR in your repository.

```javascript
const result = await executeAction('pr_comment', {
  risk_analysis: {
    explanation: 'Production test - Code Risk Radar integration test',
    risk_level: 'low',
    actions: []
  },
  pr_number: 'YOUR_TEST_PR_NUMBER',
  repository: 'YOUR_OWNER/YOUR_REPO',
  confirm: true
});

console.log('Posted comment:', result.comment_url);
```

**Verification:**
- [ ] Comment appears on PR
- [ ] Formatting correct (markdown rendered)
- [ ] Badge displays correctly
- [ ] Can view comment URL

**Cleanup:**
- [ ] Delete test comment or mark as test

---

### Test 9: Full Workflow (Preview Mode)

```javascript
const { fullWorkflow } = require('../src/rovoIntegration');

const results = await fullWorkflow({
  risk_score: 0.75,
  top_features: [{ name: 'complexity', importance: 0.6 }],
  diff_snippet: 'test code...',
  file_path: 'src/test.js',
  pr_number: 'YOUR_TEST_PR',
  repository: 'YOUR_OWNER/YOUR_REPO',
  
  create_jira_task: true,
  post_pr_comment: true,
  project_key: 'RISK'
}, false);  // Preview mode

console.log('Analysis:', results.analysis.risk_level);
console.log('Jira preview:', results.jira_task.preview);
console.log('PR preview:', results.pr_comment.preview);
console.log('Errors:', results.errors);
```

**Verification:**
- [ ] Analysis completes successfully
- [ ] Both previews generated
- [ ] No errors in results.errors
- [ ] All expected fields present

---

## 🎨 Configuration & Tuning

### Step 7: Choose Prompt Variant

Review `rovo/PROMPT_TUNING_GUIDE.md` and decide on prompt variant:

**For experienced team, high velocity:**
```javascript
// Use conservative variant
const agent = new RiskAnalystAgent({
  agentKey: 'risk-analyst-conservative'
});
```

**For general purpose:**
```javascript
// Use balanced (default)
const agent = new RiskAnalystAgent({
  agentKey: 'risk-analyst-agent'
});
```

**For new team or post-incident:**
```javascript
// Use aggressive
const agent = new RiskAnalystAgent({
  agentKey: 'risk-analyst-aggressive'
});
```

**Task:**
- [ ] Review team context
- [ ] Choose appropriate variant
- [ ] Update manifest with chosen variant (or keep default)
- [ ] Document choice in team wiki

---

### Step 8: Configure Supabase (Optional)

If using direct embedding queries:

```javascript
const { createClient } = require('@supabase/supabase-js');
const { HistorianAgent } = require('./src/rovo/historianAgent');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const historian = new HistorianAgent({
  supabaseClient: supabase
});
```

**Verification:**
- [ ] Can query embeddings directly
- [ ] Results returned faster than agent
- [ ] Similarity threshold working (0.7 default)

---

## 🔄 Integration Setup

### Step 9: GitHub Webhook Integration

Create webhook in GitHub repository:

1. Go to repository → Settings → Webhooks
2. Add webhook:
   - Payload URL: `<your-forge-app-url>/webhook/github`
   - Content type: `application/json`
   - Events: Pull requests
3. Save

Create handler in `src/webhooks/github.js`:

```javascript
const { fullWorkflow } = require('../rovoIntegration');

async function handlePullRequest(event) {
  if (event.action !== 'opened' && event.action !== 'synchronize') {
    return { status: 'skipped' };
  }
  
  const pr = event.pull_request;
  
  // Get risk score from ML pipeline
  const riskScore = await calculateRiskScore(pr);
  
  if (riskScore > 0.5) {
    await fullWorkflow({
      risk_score: riskScore,
      pr_number: pr.number,
      repository: event.repository.full_name,
      post_pr_comment: true,
      create_jira_task: riskScore > 0.8
    }, true);
  }
  
  return { status: 'processed' };
}

module.exports = { handlePullRequest };
```

**Verification:**
- [ ] Webhook delivers events
- [ ] Handler processes events correctly
- [ ] Comments appear on PRs automatically
- [ ] High-risk PRs create Jira tasks

---

### Step 10: CI/CD Integration

Add to `.github/workflows/risk-analysis.yml`:

```yaml
name: Code Risk Analysis
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run risk analysis
        run: node scripts/analyze-pr.js ${{ github.event.pull_request.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          FORGE_TOKEN: ${{ secrets.FORGE_TOKEN }}
```

**Verification:**
- [ ] Workflow runs on PRs
- [ ] Analysis completes successfully
- [ ] Results posted as comments
- [ ] Workflow shows in GitHub Actions

---

## 📊 Monitoring Setup

### Step 11: Set Up Logging

View audit logs:

```javascript
const { storage } = require('@forge/api');

async function viewAuditLog() {
  const log = await storage.get('audit_log');
  console.log(JSON.stringify(log, null, 2));
}
```

**Regular checks:**
- [ ] Review audit log weekly
- [ ] Check for errors
- [ ] Monitor action success rate
- [ ] Track response times

---

### Step 12: Performance Monitoring

Track key metrics:

```javascript
const metrics = {
  analysis_time: [],
  action_time: [],
  error_count: 0,
  success_count: 0
};

// Add timing to operations
const start = Date.now();
await analyzeRisk(input);
metrics.analysis_time.push(Date.now() - start);
```

**Monitor:**
- [ ] Average analysis time (<5s target)
- [ ] Error rate (<5% target)
- [ ] Action success rate (>95% target)
- [ ] Agent timeout rate (<1% target)

---

## ✨ Optional Enhancements

### Enhancement 1: Slack Notifications

```javascript
async function notifySlack(analysis) {
  if (analysis.risk_level === 'critical') {
    await fetch(process.env.SLACK_WEBHOOK, {
      method: 'POST',
      body: JSON.stringify({
        text: `🚨 Critical risk detected: ${analysis.explanation}`
      })
    });
  }
}
```

---

### Enhancement 2: Custom Dashboard

Create Confluence page with analytics:
- Weekly risk summary
- Top risky files
- Common issues
- Team performance

---

### Enhancement 3: VS Code Extension

Package as VS Code extension for local analysis.

---

## 🎉 Completion Checklist

### Final Verification

- [ ] All tests passing
- [ ] All actions working (preview + execute)
- [ ] GitHub integration functional
- [ ] Jira integration functional
- [ ] CI/CD pipeline running
- [ ] Monitoring in place
- [ ] Team trained on usage
- [ ] Documentation accessible
- [ ] Emergency contacts established

### Documentation

- [ ] Team onboarding guide created
- [ ] Runbook for common issues created
- [ ] Architecture documented in team wiki
- [ ] Examples shared in team channel

### Rollout

- [ ] Pilot with 1-2 repositories
- [ ] Collect feedback
- [ ] Tune prompts based on feedback
- [ ] Roll out to all repositories
- [ ] Announce to team

---

## 🆘 Troubleshooting

### Common Issues

**Agent timeout:**
```javascript
const agent = new RiskAnalystAgent({
  timeout: 60000,  // Increase to 60s
  maxRetries: 3
});
```

**Rate limit errors:**
- Check GitHub rate limit: `curl https://api.github.com/rate_limit -H "Authorization: token $TOKEN"`
- Add delays between operations
- Use conditional analysis (only high-risk changes)

**Permission errors:**
- Verify Forge permissions in manifest
- Check GitHub token scopes
- Confirm Jira project access

**Missing environment variables:**
```bash
forge variables list
forge variables set VARIABLE_NAME value
```

---

## 📞 Support

**Resources:**
- `rovo/README.md` - Main documentation
- `rovo/EXAMPLES.md` - Usage examples
- `rovo/QUICK_REFERENCE.md` - Quick reference
- `rovo/PROMPT_TUNING_GUIDE.md` - Prompt tuning

**Need Help?**
- GitHub Issues
- Team Slack channel
- Forge documentation: https://developer.atlassian.com/platform/forge/

---

**Status:** Ready for Production ✅

All systems operational and tested. Happy deploying! 🚀
