// Forge resolver integration
import { invoke } from '@forge/bridge';

let currentPrId = null;
let currentApprovalId = null;

// Initialize panel
document.addEventListener('DOMContentLoaded', async () => {
    await loadRisks();
    
    // Set up refresh button
    document.getElementById('refresh-btn').addEventListener('click', loadRisks);
});

/**
 * Load risks for current PR
 */
async function loadRisks() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const summary = document.getElementById('risk-summary');
    const riskList = document.getElementById('risk-list');
    const noRisks = document.getElementById('no-risks');
    
    // Show loading state
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    summary.classList.add('hidden');
    riskList.classList.add('hidden');
    noRisks.classList.add('hidden');
    
    try {
        // Get context from Forge
        const context = await invoke('prPanel');
        currentPrId = context.prId;
        const risks = context.risks;
        
        // Hide loading
        loading.classList.add('hidden');
        
        if (!risks || risks.length === 0) {
            noRisks.classList.remove('hidden');
            return;
        }
        
        // Show summary
        summary.classList.remove('hidden');
        updateSummary(risks);
        
        // Show risk list
        riskList.classList.remove('hidden');
        renderRisks(risks);
        
    } catch (err) {
        console.error('Failed to load risks:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

/**
 * Update summary statistics
 */
function updateSummary(risks) {
    const counts = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
    };
    
    risks.forEach(risk => {
        counts[risk.priority] = (counts[risk.priority] || 0) + 1;
    });
    
    document.getElementById('critical-count').textContent = counts.CRITICAL;
    document.getElementById('high-count').textContent = counts.HIGH;
    document.getElementById('medium-count').textContent = counts.MEDIUM;
    document.getElementById('low-count').textContent = counts.LOW;
}

/**
 * Render risk items
 */
function renderRisks(risks) {
    const container = document.getElementById('risk-list');
    container.innerHTML = '';
    
    // Sort by priority
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    risks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    risks.forEach(risk => {
        const item = createRiskItem(risk);
        container.appendChild(item);
    });
}

/**
 * Create risk item element
 */
function createRiskItem(risk) {
    const div = document.createElement('div');
    div.className = `risk-item ${risk.priority.toLowerCase()}`;
    
    div.innerHTML = `
        <div class="risk-header">
            <div class="risk-title">${escapeHtml(risk.name)}</div>
            <span class="severity-badge ${risk.priority.toLowerCase()}">${risk.priority}</span>
        </div>
        <div class="risk-description">${escapeHtml(risk.description)}</div>
        ${risk.snippet ? `
            <div class="risk-snippet">
                <code>${escapeHtml(risk.snippet)}</code>
            </div>
        ` : ''}
        ${risk.llmInsight ? `
            <div class="risk-insight">
                <strong>💡 Insight:</strong> ${escapeHtml(risk.llmInsight)}
            </div>
        ` : ''}
        <div class="risk-actions">
            <button class="btn-secondary" onclick="explainRisk('${risk.id}')">
                Explain
            </button>
            <button class="btn-secondary" onclick="suggestFix('${risk.id}')">
                Suggest Fix
            </button>
            ${risk.priority === 'CRITICAL' || risk.priority === 'HIGH' ? `
                <button class="btn-primary" onclick="createJiraIssue('${risk.id}')">
                    Create Jira Issue
                </button>
            ` : ''}
        </div>
    `;
    
    return div;
}

/**
 * Explain risk action
 */
window.explainRisk = async function(riskId) {
    try {
        const result = await invoke('explainRisk', { riskId, prId: currentPrId });
        
        if (result.success) {
            showModal('Risk Explanation', result.explanation);
        } else {
            alert('Failed to explain risk: ' + result.message);
        }
    } catch (err) {
        console.error('Failed to explain risk:', err);
        alert('An error occurred. Please try again.');
    }
};

/**
 * Suggest fix action
 */
window.suggestFix = async function(riskId) {
    try {
        const result = await invoke('suggestFix', { riskId, prId: currentPrId });
        
        if (result.success) {
            showModal('Suggested Fix', result.fullResponse, {
                showApprove: true,
                onApprove: () => approveFix(riskId, result.fixedCode)
            });
        } else {
            alert('Failed to suggest fix: ' + result.message);
        }
    } catch (err) {
        console.error('Failed to suggest fix:', err);
        alert('An error occurred. Please try again.');
    }
};

/**
 * Create Jira issue action
 */
window.createJiraIssue = async function(riskId) {
    try {
        // This would call the jiraIntegration module
        const result = await invoke('createJiraIssue', { riskId, prId: currentPrId });
        
        if (result.preview) {
            showConfirmationModal(result.preview, async () => {
                await invoke('executeJiraCreation', { approvalId: result.approvalId });
                alert('Jira issue created successfully!');
                closeModal();
            });
        }
    } catch (err) {
        console.error('Failed to create Jira issue:', err);
        alert('An error occurred. Please try again.');
    }
};

/**
 * Approve fix action
 */
async function approveFix(riskId, fixedCode) {
    try {
        // First get preview
        const previewResult = await invoke('approveFix', {
            riskId,
            prId: currentPrId,
            fixedCode,
            action: 'preview'
        });
        
        if (previewResult.preview) {
            closeModal();
            
            showConfirmationModal(previewResult.preview.preview, async () => {
                const result = await invoke('approveFix', {
                    riskId,
                    prId: currentPrId,
                    fixedCode,
                    action: 'confirm'
                });
                
                alert(result.message);
                closeModal();
                loadRisks(); // Refresh
            });
        }
    } catch (err) {
        console.error('Failed to approve fix:', err);
        alert('An error occurred. Please try again.');
    }
}

/**
 * Show modal
 */
function showModal(title, content, options = {}) {
    const modal = document.getElementById('confirmation-modal');
    const modalBody = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('confirm-btn');
    
    modal.querySelector('.modal-header h3').textContent = title;
    modalBody.innerHTML = `<div class="preview-content">${escapeHtml(content)}</div>`;
    
    if (options.showApprove) {
        confirmBtn.textContent = 'Apply Fix';
        confirmBtn.style.display = 'block';
        confirmBtn.onclick = options.onApprove;
    } else {
        confirmBtn.style.display = 'none';
    }
    
    modal.classList.remove('hidden');
}

/**
 * Show confirmation modal
 */
function showConfirmationModal(preview, onConfirm) {
    const modal = document.getElementById('confirmation-modal');
    const modalBody = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('confirm-btn');
    
    modal.querySelector('.modal-header h3').textContent = 'Confirm Action';
    modalBody.innerHTML = `
        <p>Please review the following changes before confirming:</p>
        <div class="preview-content">${escapeHtml(preview)}</div>
        <p><strong>⚠️ This action requires your explicit approval.</strong></p>
    `;
    
    confirmBtn.textContent = 'Confirm';
    confirmBtn.style.display = 'block';
    confirmBtn.onclick = onConfirm;
    
    modal.classList.remove('hidden');
}

/**
 * Close modal
 */
window.closeModal = function() {
    document.getElementById('confirmation-modal').classList.add('hidden');
};

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
