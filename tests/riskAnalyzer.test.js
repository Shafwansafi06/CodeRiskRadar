import { analyzeRisks } from '../src/riskAnalyzer';

describe('Risk Analyzer', () => {
  test('detects SQL injection pattern', async () => {
    const diff = `
+   const query = "SELECT * FROM users WHERE id = " + userId;
+   db.execute(query);
    `;
    
    const risks = await analyzeRisks(diff);
    
    expect(risks.length).toBeGreaterThan(0);
    expect(risks[0].type).toBe('sql-injection');
    expect(risks[0].severity).toBe('HIGH');
  });
  
  test('detects hardcoded secrets', async () => {
    const diff = `
+   const apiKey = "sk-1234567890abcdef";
+   const password = "MySecret123";
    `;
    
    const risks = await analyzeRisks(diff);
    
    const secretRisks = risks.filter(r => r.type === 'hardcoded-secret');
    expect(secretRisks.length).toBeGreaterThan(0);
  });
  
  test('detects eval usage', async () => {
    const diff = `
+   const result = eval(userInput);
    `;
    
    const risks = await analyzeRisks(diff);
    
    expect(risks.some(r => r.type === 'eval-usage')).toBe(true);
  });
  
  test('detects TODO comments', async () => {
    const diff = `
+   // TODO: Implement authentication
+   function login() {}
    `;
    
    const risks = await analyzeRisks(diff);
    
    expect(risks.some(r => r.type === 'todo-comment')).toBe(true);
    expect(risks.find(r => r.type === 'todo-comment').severity).toBe('LOW');
  });
  
  test('returns empty array for clean code', async () => {
    const diff = `
+   function add(a, b) {
+     return a + b;
+   }
    `;
    
    const risks = await analyzeRisks(diff);
    
    expect(risks.length).toBe(0);
  });
  
  test('calculates priority correctly', async () => {
    const diff = `
+   const query = "SELECT * FROM users WHERE id = " + userId;
    `;
    
    const risks = await analyzeRisks(diff);
    
    expect(risks[0].priority).toBeDefined();
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(risks[0].priority);
  });
});
