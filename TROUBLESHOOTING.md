# 🔧 Rovo Integration Troubleshooting Guide

Common issues and solutions for the Code Risk Radar Rovo integration.

---

## 🚨 Agent Issues

### Issue: Agent Timeout

**Symptoms:**
- Error: "Agent invocation failed: timeout"
- Analysis takes >30 seconds
- Intermittent failures

**Solutions:**

1. **Increase timeout:**
```javascript
const agent = new RiskAnalystAgent({
  timeout: 60000,  // 60 seconds
  maxRetries: 3
});
```

2. **Reduce input size:**
```javascript
// Truncate diff snippets
const truncatedDiff = diff.substring(0, 2000);
```

3. **Check Rovo service status:**
- Visit Atlassian status page
- Check for ongoing incidents

**Prevention:**
- Set reasonable timeouts (30-60s)
- Monitor average response times
- Implement circuit breaker pattern

---

### Issue: Invalid Agent Response

**Symptoms:**
- Error: "Failed to parse agent response"
- Missing required fields
- Invalid JSON

**Solutions:**

1. **Check agent prompt:**
```javascript
// Ensure prompt explicitly requests JSON
systemPrompt: |
  OUTPUT FORMAT (JSON):
  {
    "explanation": "...",
    "risk_level": "low|medium|high|critical",
    "actions": [...]
  }
```

2. **Add response validation:**
```javascript
function validateResponse(response) {
  const required = ['explanation', 'risk_level', 'actions'];
  for (const field of required) {
    if (!(field in response)) {
      throw new Error(`Missing field: ${field}`);
    }
  }
  return response;
}
```

3. **Use fallback response:**
```javascript
catch (error) {
  console.error('Parse failed:', error);
  return {
    explanation: 'Error parsing agent response',
    risk_level: 'medium',
    actions: [],
    error: error.message
  };
}
```

---

### Issue: Agent Returns Wrong Risk Level

**Symptoms:**
- Low-risk code flagged as critical
- Critical issues marked as low risk
- Inconsistent risk assessments

**Solutions:**

1. **Tune prompt variant:**
```javascript
// Try conservative for fewer false positives
const agent = new RiskAnalystAgent({
  agentKey: 'risk-analyst-conservative'
});

// Or aggressive for more sensitivity
const agent = new RiskAnalystAgent({
  agentKey: 'risk-analyst-aggressive'
});
```

2. **Provide better context:**
```javascript
{
  risk_score: 0.85,  // More accurate ML score
  top_features: [
    { name: 'sql_injection_pattern', importance: 0.9 }
  ],
  // Include more context
  file_path: 'src/auth/critical-login.js',
  diff_snippet: '... full context ...'
}
```

3. **Adjust confidence thresholds:**
```javascript
// Filter low-confidence results
analysis.actions = analysis.actions.filter(
  action => action.confidence > 0.75
);
```

See [PROMPT_TUNING_GUIDE.md](./rovo/PROMPT_TUNING_GUIDE.md) for detailed tuning.

---

## 🔗 GitHub Integration Issues

### Issue: GitHub API Rate Limit

**Symptoms:**
- Error: "API rate limit exceeded"
- Status 403 from GitHub
- Failures during batch operations

**Solutions:**

1. **Check current rate limit:**
```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

2. **Add rate limit handling:**
```javascript
async function githubRequest(url, options) {
  const response = await fetch(url, options);
  
  if (response.status === 403) {
    const resetTime = response.headers.get('x-ratelimit-reset');
    const waitTime = (resetTime * 1000) - Date.now();
    
    if (waitTime > 0) {
      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return githubRequest(url, options);  // Retry
    }
  }
  
  return response;
}
```

3. **Reduce API calls:**
```javascript
// Batch operations
const comments = await Promise.all(
  prs.slice(0, 50).map(pr => postComment(pr))  // Limit batch size
);

// Add delays
await new Promise(resolve => setTimeout(resolve, 1000));
```

**Prevention:**
- Use authenticated requests (higher limits)
- Cache responses where possible
- Implement exponential backoff
- Monitor usage regularly

---

### Issue: GitHub Token Invalid

**Symptoms:**
- Error: "Bad credentials"
- Status 401 from GitHub
- Cannot post comments or create branches

**Solutions:**

1. **Verify token:**
```bash
# Check if token is set
forge variables list

# Test token manually
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user
```

2. **Regenerate token:**
- Go to GitHub Settings → Developer settings → Personal access tokens
- Revoke old token
- Generate new token with required scopes:
  - `repo` (full control)
  - `write:discussion`
- Update Forge variable:
```bash
forge variables set GITHUB_TOKEN <new-token>
```

3. **Check token expiration:**
```javascript
// Add token validation
async function validateGitHubToken(token) {
  const response = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `token ${token}` }
  });
  
  if (!response.ok) {
    throw new Error('Invalid GitHub token');
  }
  
  return true;
}
```

---

### Issue: Cannot Post PR Comments

**Symptoms:**
- Comments not appearing on PR
- Error: "Resource not found"
- Wrong repository

**Solutions:**

1. **Verify repository format:**
```javascript
// Correct format: owner/repo
const repository = 'my-org/my-repo';  // ✅
const repository = 'my-repo';          // ❌
const repository = 'github.com/my-org/my-repo';  // ❌
```

2. **Check PR number:**
```javascript
// PR number must be numeric string or number
const pr_number = '123';   // ✅
const pr_number = 123;     // ✅
const pr_number = '#123';  // ❌
```

3. **Verify repository access:**
```bash
# Test manually
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/pulls/PR_NUMBER
```

4. **Check comment format:**
```javascript
// Ensure comment body is valid markdown
const comment = buildCommentMarkdown(analysis, metadata);
console.log('Comment length:', comment.length);
console.log('Valid markdown:', comment.includes('# '));
```

---

## 🎫 Jira Integration Issues

### Issue: Cannot Create Jira Task

**Symptoms:**
- Error: "Project does not exist"
- Error: "Issue type not found"
- Task creation fails

**Solutions:**

1. **Verify project key:**
```javascript
// Project key must be uppercase, 2-10 characters
const project_key = 'RISK';    // ✅
const project_key = 'risk';    // ❌
const project_key = 'R';       // ❌ (too short)
const project_key = 'VERYLONGKEY';  // ❌ (too long)
```

2. **Check project exists:**
```javascript
// Test Jira API access
const response = await api.asApp().requestJira(
  `/rest/api/3/project/${project_key}`
);

if (!response.ok) {
  console.error('Project not found:', project_key);
}
```

3. **Verify issue type:**
```javascript
// Check available issue types
const response = await api.asApp().requestJira(
  `/rest/api/3/project/${project_key}/statuses`
);
const data = await response.json();
console.log('Available issue types:', data);
```

4. **Check required fields:**
```javascript
// Get required fields for issue type
const response = await api.asApp().requestJira(
  `/rest/api/3/issue/createmeta?projectKeys=${project_key}`
);
```

---

### Issue: Jira Task Format Issues

**Symptoms:**
- Task description not formatted correctly
- Links broken
- Fields missing

**Solutions:**

1. **Use Jira wiki markup:**
```javascript
// Correct Jira markup
description += `h2. Risk Analysis\n\n`;  // ✅ Header
description += `*Bold text*\n`;          // ✅ Bold
description += `{{code}}\n`;             // ✅ Code
description += `# Heading\n`;            // ❌ Markdown
```

2. **Test task format:**
```javascript
// Preview before creating
const preview = generatePreview(issueData, project_key);
console.log(preview);
```

3. **Validate special characters:**
```javascript
// Escape special characters in summary
const summary = analysis.explanation
  .replace(/[[\]]/g, '')  // Remove brackets
  .substring(0, 255);     // Limit length
```

---

## 🗄️ Supabase Integration Issues

### Issue: Cannot Query Embeddings

**Symptoms:**
- Error: "Function not found"
- Empty results
- Timeout on queries

**Solutions:**

1. **Verify RPC function exists:**
```sql
-- Check in Supabase SQL editor
SELECT * FROM pg_proc WHERE proname = 'match_code_embeddings';
```

2. **Check embedding dimension:**
```javascript
// Must be 768 dimensions for most models
if (embedding.length !== 768) {
  console.error('Invalid embedding dimension:', embedding.length);
}
```

3. **Verify table structure:**
```sql
-- Check table exists
SELECT * FROM code_embeddings LIMIT 1;
```

4. **Test direct query:**
```javascript
const { data, error } = await supabase
  .from('code_embeddings')
  .select('*')
  .limit(1);

if (error) {
  console.error('Supabase error:', error);
}
```

---

## ⚙️ Configuration Issues

### Issue: Environment Variables Not Set

**Symptoms:**
- Error: "credentials not configured"
- Undefined variables
- Actions fail

**Solutions:**

1. **List current variables:**
```bash
forge variables list
```

2. **Set missing variables:**
```bash
forge variables set GITHUB_TOKEN <token>
forge variables set SUPABASE_URL <url>
forge variables set SUPABASE_KEY <key>
```

3. **Verify in code:**
```javascript
if (!process.env.GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN not set');
  throw new Error('GitHub credentials not configured');
}
```

---

### Issue: Manifest Errors

**Symptoms:**
- Deployment fails
- "Invalid manifest" errors
- Missing modules

**Solutions:**

1. **Validate YAML syntax:**
```bash
# Use online YAML validator
# Or install yamllint
yamllint manifest.yml
```

2. **Check indentation:**
```yaml
# Must use spaces, not tabs
modules:
  rovo:agent:    # ✅ 2 spaces
    - key: ...
	- key: ...     # ❌ tabs
```

3. **Verify required fields:**
```yaml
rovo:agent:
  - key: risk-analyst-agent     # Required
    name: Risk Analyst           # Required
    prompt:                      # Required
      systemPrompt: |            # Required
      userPrompt: |              # Required
```

4. **Test deploy:**
```bash
forge lint          # Check for issues
forge deploy --dry  # Test deployment
```

---

## 🐛 Runtime Errors

### Issue: Memory Errors

**Symptoms:**
- "Out of memory" errors
- Forge app crashes
- Slow performance

**Solutions:**

1. **Reduce payload size:**
```javascript
// Limit diff snippet length
const MAX_DIFF_LENGTH = 2000;
diff_snippet = diff_snippet.substring(0, MAX_DIFF_LENGTH);
```

2. **Process in batches:**
```javascript
// Don't process all at once
const BATCH_SIZE = 3;
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  await processBatch(batch);
}
```

3. **Clear unused data:**
```javascript
// Don't store large objects in memory
const analysis = await analyzeRisk(input);
const summary = formatSummary(analysis);
delete analysis.raw_data;  // Remove if not needed
```

---

### Issue: Promise Rejection

**Symptoms:**
- Unhandled promise rejection warnings
- Async operations failing silently

**Solutions:**

1. **Add proper error handling:**
```javascript
// Always use try-catch with async
async function safeAnalysis(input) {
  try {
    return await analyzeRisk(input);
  } catch (error) {
    console.error('Analysis failed:', error);
    return fallbackResponse;
  }
}
```

2. **Handle Promise.all failures:**
```javascript
// Use Promise.allSettled for graceful degradation
const results = await Promise.allSettled([
  analyzeRisk(input1),
  analyzeRisk(input2),
  analyzeRisk(input3)
]);

const successful = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);
```

---

## 📊 Performance Issues

### Issue: Slow Response Times

**Symptoms:**
- Analysis takes >10 seconds
- Timeouts in production
- Poor user experience

**Solutions:**

1. **Optimize prompt size:**
```javascript
// Reduce prompt variables
const topFeatures = features
  .slice(0, 5)  // Only top 5
  .map(f => `${f.name}: ${f.importance.toFixed(2)}`);
```

2. **Use parallel processing:**
```javascript
// Run analysis and history in parallel
const [analysis, history] = await Promise.all([
  analyzeRisk(input),
  queryHistory(input)
]);
```

3. **Add caching:**
```javascript
const cache = new Map();

async function cachedAnalysis(input) {
  const key = JSON.stringify(input);
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = await analyzeRisk(input);
  cache.set(key, result);
  return result;
}
```

4. **Profile slow operations:**
```javascript
const start = Date.now();
const result = await analyzeRisk(input);
console.log(`Analysis took ${Date.now() - start}ms`);
```

---

## 🔒 Security Issues

### Issue: Input Injection

**Symptoms:**
- Unexpected agent responses
- Prompt manipulation
- Security vulnerabilities

**Solutions:**

1. **Sanitize all inputs:**
```javascript
function sanitizeInput(text) {
  return text
    .replace(/```/g, '\\`\\`\\`')  // Escape code blocks
    .replace(/{{/g, '\\{\\{')      // Escape template vars
    .substring(0, 10000);           // Limit length
}
```

2. **Validate input types:**
```javascript
function validateInput(input) {
  if (typeof input.risk_score !== 'number') {
    throw new Error('risk_score must be a number');
  }
  
  if (!Array.isArray(input.top_features)) {
    throw new Error('top_features must be an array');
  }
}
```

3. **Use parameterized queries:**
```javascript
// Never concatenate SQL
const query = 'SELECT * FROM incidents WHERE id = ?';  // ✅
const query = `SELECT * FROM incidents WHERE id = ${id}`;  // ❌
```

---

## 📝 Logging & Debugging

### Enable Debug Logging

```javascript
// Add at top of file
const DEBUG = process.env.DEBUG === 'true';

function debug(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

// Use throughout code
debug('Analyzing risk for file:', filePath);
debug('Agent response:', response);
```

### Enable in Forge

```bash
forge variables set DEBUG true
```

### View Logs

```bash
# Tail logs in real-time
forge logs --tail

# Filter by keyword
forge logs | grep ERROR

# View last 100 lines
forge logs | tail -n 100
```

---

## 🆘 Emergency Procedures

### Disable Integration Temporarily

```bash
# Option 1: Uninstall app
forge uninstall

# Option 2: Disable specific actions in manifest
# Comment out action definitions
# rovo:action:
#   - key: create-jira-task-action  # Disabled
```

### Rollback Deployment

```bash
# List deployments
forge deploy list

# Rollback to previous version
forge deploy rollback <version>
```

### Contact Support

1. **Gather information:**
   - Error messages
   - Logs
   - Reproduction steps
   - Environment details

2. **Check resources:**
   - [Forge Documentation](https://developer.atlassian.com/platform/forge/)
   - [Community Forum](https://community.developer.atlassian.com/)
   - GitHub Issues

3. **Open support ticket:**
   - Include all gathered information
   - Provide minimal reproduction example

---

## 📚 Additional Resources

- **Documentation:** `rovo/README.md`
- **Examples:** `rovo/EXAMPLES.md`
- **Quick Reference:** `rovo/QUICK_REFERENCE.md`
- **Implementation Guide:** `IMPLEMENTATION_CHECKLIST.md`
- **Forge Docs:** https://developer.atlassian.com/platform/forge/

---

**Still having issues?** Open a GitHub issue with:
- Error message
- Relevant code
- Steps to reproduce
- Environment details
