# Security & Safety Guidelines

## Core Principles

Code Risk Radar is designed with **security-first, safety-first** principles. This document outlines our approach to protecting user data, ensuring safe operations, and maintaining transparency.

---

## 1. Explicit User Consent

### All Write Operations Require Approval

**Scope**: Any action that modifies Bitbucket repositories or Jira issues must:
1. Generate a dry-run preview
2. Display the preview to the user in a modal dialog
3. Require explicit user click on "Approve" button
4. Log the approval event with timestamp and user ID

**Covered Operations**:
- Creating Jira issues
- Updating Jira issues (comments, status changes)
- Committing code fixes to repositories
- Adding PR comments with automated suggestions

### Preview Format

All previews follow this structure:
```
Action: [CREATE_JIRA_ISSUE | UPDATE_JIRA_ISSUE | COMMIT_FIX | ADD_PR_COMMENT]
Target: [Issue key, PR number, file path]
Changes: [Detailed description of what will be modified]
Impact: [Who will be notified, what will be visible]
```

### Example Flow

```javascript
// User clicks "Create Jira Issue"
1. System generates preview → stores approval request (status: PENDING)
2. Modal displays preview → user reviews
3. User clicks "Confirm" → updates status to APPROVED
4. System executes action → logs to audit trail
```

---

## 2. Rate Limiting & Cost Control

### LLM Call Limits

- **Maximum 10 LLM calls per PR analysis**
- Cached results stored in Forge Entities (TTL: 7 days)
- If limit exceeded, regex-only analysis continues without LLM enhancement

### Token Management

- Input text truncated to 3000 characters for risk snippets
- Embeddings limited to 8000 characters
- Response max tokens capped at 2000

### Fallback Behavior

If LLM service is unavailable:
1. Continue with regex pattern matching
2. Post comment: "Risk analysis completed with basic detection (AI unavailable)"
3. Never block PR merge due to analysis failures

---

## 3. Data Minimization

### What We Send to External APIs

✅ **Allowed**:
- Code diffs (added/modified lines only)
- Risk snippets (max 100 characters around match)
- Anonymized metadata (severity, category, type)

❌ **Never Sent**:
- Full repository contents
- Commit history
- User emails or personal info
- Credentials or secrets (even if detected in code)

### Data Storage

**Forge Entities** (primary storage):
- Risk analysis results (7 day TTL)
- Approval requests (30 day TTL)
- Audit logs (90 day TTL, then archived)

**Supabase pgvector** (optional):
- Only risk embeddings (no code snippets)
- Metadata: risk type, severity, repository slug
- No PII or credentials

### Data Deletion

Users can request deletion via:
```bash
forge storage:delete pr-risks-{PR_ID}
```

---

## 4. Audit Trail

### Logged Events

Every approved action is logged with:
- `approvalId`: Unique identifier
- `action`: Type of operation
- `userId`: Atlassian account ID of approver
- `timestamp`: ISO 8601 format
- `target`: Affected resource (issue key, PR ID, etc.)
- `preview`: Copy of what user approved

### Accessing Audit Logs

Admins can query logs via Forge storage:
```javascript
const auditLog = await storage.get('audit-log');
```

Logs are automatically pruned to keep last 1000 events.

---

## 5. Fail-Safe Defaults

### Never Block PRs

- If risk analysis fails, PR can still be merged
- Generic comment posted: "⚠️ Risk scan incomplete. Review manually."
- Error details logged but not exposed to users

### Graceful Degradation

| Component Fails | Behavior |
|-----------------|----------|
| OpenAI API | Regex-only detection continues |
| Supabase | Skip vector search, use basic scoring |
| Jira API | Store pending issue creation, retry later |
| Bitbucket API | Log error, don't retry (avoid spam) |

---

## 6. User Control

### Team Configuration

Teams can customize behavior:

```javascript
{
  "autoCreateJiraIssues": false,          // Require manual trigger
  "severityThreshold": "HIGH",            // Only alert on HIGH+ risks
  "allowedCategories": ["SECURITY"],      // Filter by category
  "llmEnabled": true,                     // Disable AI analysis
  "notificationChannels": ["slack"]       // Where to send alerts
}
```

### Disable for Specific Repos

Add `.coderiskadar.yml` to repository root:
```yaml
enabled: false
# or
ignore_patterns:
  - "*.test.js"
  - "docs/**"
```

---

## 7. Compliance & Standards

### Security Standards Referenced

- **OWASP Top 10**: Web application security risks
- **CWE**: Common Weakness Enumeration
- **SANS Top 25**: Most dangerous software errors
- **NIST**: Secure software development practices

### Data Residency

- **Forge**: Data stored in Atlassian infrastructure (complies with regional data residency)
- **OpenAI**: Data processed in US/EU regions (configurable)
- **Supabase**: Self-hosted or regional deployment options

### GDPR Compliance

- Users can request data export via Forge storage API
- Data deletion requests honored within 30 days
- No personal data processed without consent

---

## 8. Vulnerability Disclosure

If you discover a security vulnerability in Code Risk Radar:

1. **Do not** open a public GitHub issue
2. Email: security@yourdomain.com
3. Include: Description, reproduction steps, potential impact
4. We will respond within 48 hours

---

## 9. Security Testing

### Pre-Deployment Checklist

- [ ] All write operations have dry-run previews
- [ ] Rate limiting configured and tested
- [ ] Audit logs verified for all approval flows
- [ ] Error handling doesn't leak sensitive info
- [ ] External API calls use timeout (30s max)
- [ ] Storage encryption enabled (Forge default)

### Ongoing Monitoring

- Weekly audit log reviews
- Monthly dependency updates (`npm audit fix`)
- Quarterly penetration testing

---

## 10. Incident Response

### If a Security Issue is Detected

1. **Immediate**: Disable affected functionality via feature flag
2. **Within 1 hour**: Notify affected users via Jira/Bitbucket comment
3. **Within 24 hours**: Deploy fix and post-mortem report
4. **Within 7 days**: Conduct retrospective and update security docs

### Contact

- **Support**: support@yourdomain.com
- **Security**: security@yourdomain.com
- **Status Page**: status.coderiskadar.io

---

**Last Updated**: December 5, 2025  
**Version**: 1.0.0  
**Review Cycle**: Quarterly
