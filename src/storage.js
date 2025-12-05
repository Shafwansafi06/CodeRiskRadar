import { storage } from '@forge/api';

/**
 * Store PR risk analysis results
 */
export async function storePrRisks(prId, risks) {
  const key = `pr-risks-${prId}`;
  await storage.set(key, {
    prId,
    risks,
    analyzedAt: new Date().toISOString(),
    version: 1
  });
}

/**
 * Get stored PR risks
 */
export async function getPrRisks(prId) {
  const key = `pr-risks-${prId}`;
  const data = await storage.get(key);
  return data ? data.risks : [];
}

/**
 * Store approval request for write operations
 */
export async function storeApprovalRequest(request) {
  const approvalId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  await storage.set(approvalId, {
    ...request,
    createdAt: new Date().toISOString()
  });
  
  // Also add to pending approvals list
  const pendingList = await storage.get('pending-approvals') || [];
  pendingList.push(approvalId);
  await storage.set('pending-approvals', pendingList);
  
  return approvalId;
}

/**
 * Get approval request status
 */
export async function getApprovalStatus(approvalId) {
  return await storage.get(approvalId);
}

/**
 * Update approval status (APPROVED/REJECTED)
 */
export async function updateApprovalStatus(approvalId, status, userId) {
  const approval = await storage.get(approvalId);
  
  if (!approval) {
    throw new Error('Approval request not found');
  }
  
  approval.status = status;
  approval.approvedBy = userId;
  approval.approvedAt = new Date().toISOString();
  
  await storage.set(approvalId, approval);
  
  // Remove from pending list
  const pendingList = await storage.get('pending-approvals') || [];
  const updatedList = pendingList.filter(id => id !== approvalId);
  await storage.set('pending-approvals', updatedList);
  
  return approval;
}

/**
 * Get all pending approval requests
 */
export async function getPendingApprovals() {
  const pendingList = await storage.get('pending-approvals') || [];
  const approvals = [];
  
  for (const approvalId of pendingList) {
    const approval = await storage.get(approvalId);
    if (approval) {
      approvals.push({ id: approvalId, ...approval });
    }
  }
  
  return approvals;
}

/**
 * Store project configuration
 */
export async function storeProjectConfig(projectKey, config) {
  await storage.set(`config-${projectKey}`, {
    ...config,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Get project configuration
 */
export async function getProjectConfig(projectKey) {
  return await storage.get(`config-${projectKey}`);
}

/**
 * Store risk history for vector search context
 */
export async function storeRiskHistory(riskId, data) {
  const historyKey = `risk-history-${riskId}`;
  const history = await storage.get(historyKey) || [];
  
  history.push({
    ...data,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 50 occurrences
  if (history.length > 50) {
    history.shift();
  }
  
  await storage.set(historyKey, history);
}

/**
 * Get risk history
 */
export async function getRiskHistory(riskId) {
  const historyKey = `risk-history-${riskId}`;
  return await storage.get(historyKey) || [];
}
