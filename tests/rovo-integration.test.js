/**
 * Test Suite for Rovo Integration
 * 
 * Run with: npm test -- tests/rovo-integration.test.js
 */

const {
  analyzeRisk,
  queryHistory,
  executeAction,
  fullWorkflow,
  processBatch,
  formatRiskSummary,
  formatIncidents
} = require('../src/rovoIntegration');

// Mock Forge API
jest.mock('@forge/api', () => ({
  invoke: jest.fn(),
  storage: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

const { invoke, storage } = require('@forge/api');

// Mock node-fetch
jest.mock('node-fetch');
const fetch = require('node-fetch');

describe('RiskAnalyst Agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should analyze critical SQL injection risk', async () => {
    // Mock agent response
    invoke.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'SQL injection vulnerability detected',
        risk_level: 'critical',
        actions: [
          {
            type: 'security',
            priority: 'high',
            description: 'Use parameterized queries',
            evidence_lines: ["db.query(`SELECT * FROM users WHERE id='${userId}'`)"],
            effort_estimate: '30 minutes',
            confidence: 0.95
          }
        ]
      })
    });

    const input = {
      risk_score: 0.95,
      top_features: [
        { name: 'sql_keywords', importance: 0.45 }
      ],
      diff_snippet: "db.query(`SELECT * FROM users WHERE id='${userId}'`);",
      file_path: 'src/auth.js',
      pr_number: '123'
    };

    const result = await analyzeRisk(input);

    expect(result.risk_level).toBe('critical');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('security');
    expect(result.actions[0].confidence).toBeGreaterThan(0.9);
    expect(invoke).toHaveBeenCalledWith('rovo.agent.invoke', expect.any(Object));
  });

  test('should handle low risk changes', async () => {
    invoke.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'Minor code style improvements',
        risk_level: 'low',
        actions: []
      })
    });

    const input = {
      risk_score: 0.15,
      diff_snippet: 'const x = 1;',
      file_path: 'src/utils.js'
    };

    const result = await analyzeRisk(input);

    expect(result.risk_level).toBe('low');
    expect(result.actions).toHaveLength(0);
  });

  test('should handle agent errors gracefully', async () => {
    invoke.mockRejectedValue(new Error('Agent timeout'));

    const input = {
      risk_score: 0.5,
      diff_snippet: 'test',
      file_path: 'test.js'
    };

    await expect(analyzeRisk(input)).rejects.toThrow('Agent timeout');
  });

  test('should format risk summary correctly', () => {
    const analysis = {
      risk_level: 'high',
      explanation: 'Security issue detected',
      actions: [
        {
          type: 'security',
          priority: 'high',
          description: 'Fix immediately',
          effort_estimate: '1 hour',
          confidence: 0.9
        }
      ]
    };

    const summary = formatRiskSummary(analysis);

    expect(summary).toContain('🔴');
    expect(summary).toContain('HIGH');
    expect(summary).toContain('Security issue detected');
    expect(summary).toContain('Fix immediately');
  });

  test('should sanitize potentially malicious input', async () => {
    invoke.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'Test',
        risk_level: 'medium',
        actions: []
      })
    });

    const input = {
      risk_score: 0.5,
      diff_snippet: '```malicious{{code}}```',
      file_path: '../../../etc/passwd'
    };

    await analyzeRisk(input);

    const callArgs = invoke.mock.calls[0][1];
    expect(callArgs.variables.diff_snippet).not.toContain('```');
    expect(callArgs.variables.diff_snippet).not.toContain('{{');
  });
});

describe('Historian Agent', () => {
  test('should query similar incidents', async () => {
    invoke.mockResolvedValue({
      content: JSON.stringify({
        similar_incidents: [
          {
            id: 'INC-001',
            summary: 'SQL injection in auth',
            similarity: 0.92,
            resolution: 'Used parameterized queries',
            link: 'https://jira.test/INC-001',
            lessons: ['Always parameterize queries']
          }
        ],
        patterns: ['SQL injection is common in auth code'],
        recommendations: ['Add automated security testing']
      })
    });

    const input = {
      embedding_vector: new Array(768).fill(0.1),
      code_signature: 'sql_auth',
      risk_score: 0.85
    };

    const result = await queryHistory(input);

    expect(result.similar_incidents).toHaveLength(1);
    expect(result.similar_incidents[0].similarity).toBeGreaterThan(0.9);
    expect(result.patterns).toBeDefined();
  });

  test('should handle no matches found', async () => {
    invoke.mockResolvedValue({
      content: JSON.stringify({
        similar_incidents: [],
        patterns: [],
        recommendations: []
      })
    });

    const input = {
      embedding_vector: new Array(768).fill(0),
      code_signature: 'unique_code'
    };

    const result = await queryHistory(input);

    expect(result.similar_incidents).toHaveLength(0);
  });

  test('should format incidents for display', () => {
    const history = {
      similar_incidents: [
        {
          id: 'INC-001',
          summary: 'Test incident',
          similarity: 0.85,
          severity: 'high',
          resolution: 'Fixed it'
        }
      ],
      patterns: ['Pattern 1'],
      recommendations: ['Rec 1']
    };

    const formatted = formatIncidents(history);

    expect(formatted).toContain('INC-001');
    expect(formatted).toContain('Test incident');
    expect(formatted).toContain('85%');
    expect(formatted).toContain('Pattern 1');
  });
});

describe('Action: createJiraTask', () => {
  beforeEach(() => {
    storage.get.mockResolvedValue([]);
    storage.set.mockResolvedValue();
  });

  test('should generate preview when confirm=false', async () => {
    const input = {
      risk_analysis: {
        explanation: 'Critical issue',
        risk_level: 'critical',
        actions: []
      },
      project_key: 'RISK',
      confirm: false
    };

    const result = await executeAction('jira', input);

    expect(result.success).toBe(true);
    expect(result.preview).toBeDefined();
    expect(result.requires_confirmation).toBe(true);
    expect(result.task_key).toBeNull();
    expect(result.preview).toContain('RISK');
    expect(result.preview).toContain('Critical issue');
  });

  test('should create task when confirm=true', async () => {
    // Mock Jira API response
    const mockJiraResponse = {
      ok: true,
      json: jest.fn().resolvedValue({ key: 'RISK-123' }),
      text: jest.fn()
    };

    // Mock requestJira
    require('@forge/api').asApp = jest.fn(() => ({
      requestJira: jest.fn().mockResolvedValue(mockJiraResponse)
    }));

    const input = {
      risk_analysis: {
        explanation: 'Critical issue',
        risk_level: 'critical',
        actions: []
      },
      project_key: 'RISK',
      confirm: true
    };

    const result = await executeAction('jira', input);

    expect(result.success).toBe(true);
    expect(result.task_key).toBe('RISK-123');
    expect(result.requires_confirmation).toBe(false);
    expect(result.created).toBe(true);
  });

  test('should validate project key format', async () => {
    const input = {
      risk_analysis: { explanation: 'Test', risk_level: 'low', actions: [] },
      project_key: 'invalid-key',
      confirm: false
    };

    const result = await executeAction('jira', input);

    expect(result.success).toBe(false);
    expect(result.error).toContain('project_key');
  });
});

describe('Action: postPRComment', () => {
  test('should generate comment preview', async () => {
    const input = {
      risk_analysis: {
        explanation: 'Security issue found',
        risk_level: 'high',
        actions: [
          {
            type: 'security',
            priority: 'high',
            description: 'Fix this',
            effort_estimate: '1 hour',
            confidence: 0.9
          }
        ]
      },
      pr_number: '123',
      repository: 'owner/repo',
      confirm: false
    };

    const result = await executeAction('pr_comment', input);

    expect(result.success).toBe(true);
    expect(result.preview).toBeDefined();
    expect(result.preview).toContain('owner/repo');
    expect(result.preview).toContain('#123');
    expect(result.preview).toContain('Security issue found');
  });

  test('should post comment when confirm=true', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().resolvedValue({
        id: 987654321,
        html_url: 'https://github.com/owner/repo/pull/123#issuecomment-987654321'
      })
    });

    // Mock GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'test-token';

    const input = {
      risk_analysis: {
        explanation: 'Issue',
        risk_level: 'medium',
        actions: []
      },
      pr_number: '123',
      repository: 'owner/repo',
      confirm: true
    };

    const result = await executeAction('pr_comment', input);

    expect(result.success).toBe(true);
    expect(result.comment_id).toBe('987654321');
    expect(result.posted).toBe(true);
    expect(fetch).toHaveBeenCalled();
  });

  test('should validate repository format', async () => {
    const input = {
      risk_analysis: { explanation: 'Test', risk_level: 'low', actions: [] },
      pr_number: '123',
      repository: 'invalid',
      confirm: false
    };

    const result = await executeAction('pr_comment', input);

    expect(result.success).toBe(false);
    expect(result.error).toContain('repository');
  });
});

describe('Action: createFixBranchPR', () => {
  test('should require explicit confirmation', async () => {
    const input = {
      risk_analysis: { explanation: 'Test', risk_level: 'high', actions: [] },
      base_branch: 'main',
      fix_description: 'Fix the issue',
      repository: 'owner/repo',
      confirm: false
    };

    const result = await executeAction('fix_branch', input);

    expect(result.success).toBe(true);
    expect(result.preview).toBeDefined();
    expect(result.requires_confirmation).toBe(true);
    expect(result.warning).toContain('manual confirmation');
  });

  test('should create branch and PR when confirmed', async () => {
    // Mock GitHub API calls
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().resolvedValue({ object: { sha: 'abc123' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().resolvedValue({ ref: 'refs/heads/fix/test' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().resolvedValue({
          number: 456,
          html_url: 'https://github.com/owner/repo/pull/456'
        })
      });

    process.env.GITHUB_TOKEN = 'test-token';

    const input = {
      risk_analysis: { explanation: 'Issue', risk_level: 'critical', actions: [] },
      base_branch: 'main',
      fix_description: 'Implement parameterized queries',
      repository: 'owner/repo',
      confirm: true
    };

    const result = await executeAction('fix_branch', input);

    expect(result.success).toBe(true);
    expect(result.branch_name).toBeDefined();
    expect(result.pr_number).toBe('456');
    expect(result.created).toBe(true);
  });

  test('should validate fix description length', async () => {
    const input = {
      risk_analysis: { explanation: 'Test', risk_level: 'high', actions: [] },
      base_branch: 'main',
      fix_description: 'short', // Too short
      repository: 'owner/repo',
      confirm: true
    };

    const result = await executeAction('fix_branch', input);

    expect(result.success).toBe(false);
    expect(result.error).toContain('fix_description');
  });
});

describe('Full Workflow', () => {
  test('should execute complete workflow in preview mode', async () => {
    // Mock risk analysis
    invoke.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'Test issue',
        risk_level: 'high',
        actions: []
      })
    });

    const input = {
      risk_score: 0.8,
      diff_snippet: 'test',
      file_path: 'test.js',
      pr_number: '123',
      repository: 'owner/repo',
      create_jira_task: true,
      post_pr_comment: true,
      project_key: 'RISK'
    };

    const result = await fullWorkflow(input, false);

    expect(result.analysis).toBeDefined();
    expect(result.jira_task).toBeDefined();
    expect(result.pr_comment).toBeDefined();
    expect(result.jira_task.requires_confirmation).toBe(true);
    expect(result.pr_comment.requires_confirmation).toBe(true);
  });

  test('should handle partial workflow failures gracefully', async () => {
    invoke.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'Test',
        risk_level: 'medium',
        actions: []
      })
    });

    // Mock Jira failure
    require('@forge/api').asApp = jest.fn(() => ({
      requestJira: jest.fn().mockRejectedValue(new Error('Jira API error'))
    }));

    const input = {
      risk_score: 0.5,
      diff_snippet: 'test',
      create_jira_task: true,
      project_key: 'RISK'
    };

    const result = await fullWorkflow(input, true);

    expect(result.analysis).toBeDefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].step).toBe('jira_task');
  });
});

describe('Batch Processing', () => {
  test('should process multiple changes', async () => {
    invoke.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'Test',
        risk_level: 'medium',
        actions: []
      })
    });

    const changes = [
      { risk_score: 0.6, diff_snippet: 'test1', file_path: 'file1.js' },
      { risk_score: 0.7, diff_snippet: 'test2', file_path: 'file2.js' },
      { risk_score: 0.8, diff_snippet: 'test3', file_path: 'file3.js' }
    ];

    const result = await processBatch(changes, { concurrency: 2 });

    expect(result.results).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  test('should handle batch errors without stopping', async () => {
    invoke
      .mockResolvedValueOnce({
        content: JSON.stringify({ explanation: 'OK', risk_level: 'low', actions: [] })
      })
      .mockRejectedValueOnce(new Error('Analysis failed'))
      .mockResolvedValueOnce({
        content: JSON.stringify({ explanation: 'OK', risk_level: 'low', actions: [] })
      });

    const changes = [
      { risk_score: 0.5, diff_snippet: 'test1' },
      { risk_score: 0.6, diff_snippet: 'test2' },
      { risk_score: 0.7, diff_snippet: 'test3' }
    ];

    const result = await processBatch(changes);

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(1);
  });
});

describe('Input Validation', () => {
  test('should reject invalid risk_level values', async () => {
    invoke.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'Test',
        risk_level: 'invalid',
        actions: []
      })
    });

    const result = await analyzeRisk({
      risk_score: 0.5,
      diff_snippet: 'test'
    });

    // Should default to 'medium'
    expect(['low', 'medium', 'high', 'critical']).toContain(result.risk_level);
  });

  test('should handle missing required fields', async () => {
    const input = {
      // Missing risk_analysis
      project_key: 'RISK',
      confirm: false
    };

    const result = await executeAction('jira', input);

    expect(result.success).toBe(false);
    expect(result.error).toContain('risk_analysis');
  });
});

describe('Performance', () => {
  test('should complete analysis within timeout', async () => {
    invoke.mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          content: JSON.stringify({
            explanation: 'Test',
            risk_level: 'low',
            actions: []
          })
        }), 100)
      )
    );

    const start = Date.now();
    await analyzeRisk({ risk_score: 0.3, diff_snippet: 'test' });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('should handle concurrent analyses', async () => {
    invoke.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'Test',
        risk_level: 'low',
        actions: []
      })
    });

    const promises = Array(10).fill(null).map((_, i) =>
      analyzeRisk({ risk_score: 0.5, diff_snippet: `test${i}` })
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    results.forEach(r => expect(r.risk_level).toBeDefined());
  });
});
