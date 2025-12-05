import { buildJiraIssuePayload, createJiraIssueWithConfirmation } from '../src/jiraIntegration';

describe('Jira Integration', () => {
  const mockRisk = {
    id: 'risk-1',
    name: 'SQL Injection',
    type: 'sql-injection',
    severity: 'HIGH',
    category: 'SECURITY',
    priority: 'CRITICAL',
    description: 'Detected SQL injection vulnerability',
    snippet: 'SELECT * FROM users WHERE id = " + userId',
    suggestedFix: 'Use parameterized queries'
  };
  
  const mockPrContext = {
    prId: '123',
    repoSlug: 'test-repo',
    workspaceSlug: 'test-workspace'
  };
  
  test('creates Jira issue payload with correct structure', () => {
    process.env.JIRA_PROJECT_KEY = 'RISK';
    
    const payload = buildJiraIssuePayload(mockRisk, mockPrContext);
    
    expect(payload.fields.project.key).toBe('RISK');
    expect(payload.fields.summary).toContain('SQL Injection');
    expect(payload.fields.summary).toContain('PR #123');
    expect(payload.fields.issuetype.name).toBe('Bug');
    expect(payload.fields.labels).toContain('code-risk');
    expect(payload.fields.labels).toContain('pr-123');
  });
  
  test('sets priority based on risk level', () => {
    const criticalRisk = { ...mockRisk, priority: 'CRITICAL' };
    const payload = buildJiraIssuePayload(criticalRisk, mockPrContext);
    expect(payload.fields.priority.name).toBe('Highest');
    
    const highRisk = { ...mockRisk, priority: 'HIGH' };
    const payload2 = buildJiraIssuePayload(highRisk, mockPrContext);
    expect(payload2.fields.priority.name).toBe('High');
    
    const mediumRisk = { ...mockRisk, priority: 'MEDIUM' };
    const payload3 = buildJiraIssuePayload(mediumRisk, mockPrContext);
    expect(payload3.fields.priority.name).toBe('Medium');
  });
  
  test('includes risk details in description', () => {
    const payload = buildJiraIssuePayload(mockRisk, mockPrContext);
    const description = JSON.stringify(payload.fields.description);
    
    expect(description).toContain('sql-injection');
    expect(description).toContain('HIGH');
    expect(description).toContain('SECURITY');
    expect(description).toContain('Use parameterized queries');
  });
  
  test('createJiraIssueWithConfirmation returns approval request', async () => {
    const result = await createJiraIssueWithConfirmation(mockRisk, mockPrContext);
    
    expect(result.approvalId).toBeDefined();
    expect(result.preview).toBeDefined();
    expect(result.message).toContain('Approval required');
  });
});
