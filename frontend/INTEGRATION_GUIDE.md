# Frontend Integration Guide

## 🎯 Overview

This guide explains how to integrate the React Custom UI with your Forge app backend and deploy it as a PR sidebar.

---

## 📋 Prerequisites

- Atlassian Forge CLI installed (`npm install -g @forge/cli`)
- Node.js 18+ and npm
- Forge app already configured with Rovo agents and actions
- Access to Bitbucket or GitHub repository

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  PR Sidebar (Forge UI)               │
│                                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │         React Custom UI (frontend/)          │   │
│  │  • App.jsx - Main orchestration              │   │
│  │  • Radar.jsx - D3 visualization              │   │
│  │  • RiskBreakdown.jsx - Actions list          │   │
│  │  • SimilarIncidents.jsx - History            │   │
│  │  • ActionsPanel.jsx - Action buttons         │   │
│  │  • ConfirmationModal.jsx - Preview/confirm   │   │
│  └─────────────────────────────────────────────┘   │
│                       ↕ @forge/bridge                │
│  ┌─────────────────────────────────────────────┐   │
│  │      Forge Backend (src/rovo/)               │   │
│  │  • riskAgent.js - Risk analysis              │   │
│  │  • historianAgent.js - Similar incidents     │   │
│  │  • createJiraTask.js - Jira integration      │   │
│  │  • postPRComment.js - GitHub integration     │   │
│  └─────────────────────────────────────────────┘   │
│                       ↕                              │
│            Rovo Agents & Actions API                 │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Step 1: Update Forge Manifest

Add the Custom UI module to your `manifest.yml`:

```yaml
modules:
  # ... existing modules ...

  # Custom UI for PR Sidebar
  forge:resource:
    - key: risk-radar-ui-resources
      path: frontend/build
      
  function:
    # Bridge functions to expose backend to frontend
    - key: get-risk-analysis
      handler: getRiskAnalysis.handler
    
    - key: create-jira-task
      handler: createJiraTask.handler
    
    - key: post-pr-comment
      handler: postPRComment.handler
    
    - key: get-similar-incidents
      handler: getSimilarIncidents.handler
    
    - key: refresh-analysis
      handler: refreshAnalysis.handler

  # Bitbucket PR Sidebar
  bitbucket:pullRequestSidebar:
    - key: risk-radar-sidebar
      resource: risk-radar-ui-resources
      title: Code Risk Radar
      render: native
      resolver:
        function: get-risk-analysis
```

**For GitHub instead of Bitbucket:**

```yaml
  github:pullRequestPanel:
    - key: risk-radar-panel
      resource: risk-radar-ui-resources
      title: Code Risk Radar
      render: native
      resolver:
        function: get-risk-analysis
```

---

## 🔧 Step 2: Create Forge Backend Bridge Functions

Create `src/bridge/` directory with handler functions:

### `src/bridge/getRiskAnalysis.js`

```javascript
import Resolver from '@forge/resolver';
import { RiskAnalystAgent } from '../rovo/riskAgent';
import { HistorianAgent } from '../rovo/historianAgent';

const resolver = new Resolver();

resolver.define('getRiskAnalysis', async (req) => {
  const { context } = req;
  
  // Extract PR context
  const prNumber = context.extension.pullRequest?.id;
  const repository = context.extension.repository?.full_name;
  const diff = context.extension.pullRequest?.diff_url;
  
  if (!prNumber || !repository) {
    return { error: 'Invalid PR context' };
  }

  try {
    // Analyze with RiskAnalyst agent
    const riskAgent = new RiskAnalystAgent();
    const riskAnalysis = await riskAgent.analyze({
      diff_url: diff,
      pr_number: prNumber,
      repository
    });

    // Get similar incidents from Historian
    const historianAgent = new HistorianAgent();
    const historicalContext = await historianAgent.query({
      code_diff: riskAnalysis.diff_summary,
      top_k: 3
    });

    return {
      risk_analysis: riskAnalysis,
      historical_context: historicalContext,
      metadata: {
        pr_number: prNumber,
        repository,
        diff_url: diff,
        analyzed_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Risk analysis failed:', error);
    return { error: error.message };
  }
});

export const handler = resolver.getDefinitions();
```

### `src/bridge/createJiraTask.js`

```javascript
import Resolver from '@forge/resolver';
import { createJiraTaskHandler } from '../actions/createJiraTask';

const resolver = new Resolver();

resolver.define('createJiraTask', async (req) => {
  const { payload } = req;
  const { risk_analysis, confirm } = payload;
  
  return await createJiraTaskHandler({
    risk_analysis,
    confirm: confirm === true
  });
});

export const handler = resolver.getDefinitions();
```

### `src/bridge/postPRComment.js`

```javascript
import Resolver from '@forge/resolver';
import { postPRCommentHandler } from '../actions/postPRComment';

const resolver = new Resolver();

resolver.define('postPRComment', async (req) => {
  const { payload, context } = req;
  const { risk_analysis, confirm } = payload;
  
  const prNumber = context.extension.pullRequest?.id;
  const repository = context.extension.repository?.full_name;
  
  return await postPRCommentHandler({
    risk_analysis,
    pr_number: prNumber,
    repository,
    confirm: confirm === true
  });
});

export const handler = resolver.getDefinitions();
```

---

## 🔧 Step 3: Build and Deploy

### 3.1 Build Frontend

```bash
cd frontend
npm install
npm run build
```

This creates `frontend/build/` with compiled React app.

### 3.2 Deploy Forge App

```bash
# From project root
forge deploy

# Register the app (first time only)
forge install

# Or upgrade existing installation
forge install --upgrade
```

### 3.3 View Logs

```bash
# Monitor backend logs
forge logs

# View deployment status
forge deploy --verbose
```

---

## 🧪 Testing

### Local Development (Mock Data)

```bash
cd frontend
npm start
```

This runs the UI with mock data on `http://localhost:3000`.

### Forge Tunnel Testing

```bash
# Terminal 1: Start tunnel
forge tunnel

# Terminal 2: Rebuild frontend on changes
cd frontend
npm run build --watch
```

Open a PR in your Bitbucket/GitHub repository to see the sidebar.

---

## 🎨 Customization

### Update Styling

Edit `frontend/src/styles.css` to customize colors, spacing, or layout.

**Example: Change primary color**

```css
:root {
  --color-primary: #0052cc; /* Change to your brand color */
}
```

### Modify Mock Data

Edit `frontend/scripts/sample_prs.json` to test different scenarios locally.

### Add New Components

1. Create component in `frontend/src/components/`
2. Import and use in `App.jsx`
3. Add styles to `styles.css`

---

## 🔒 Security Considerations

### 1. Input Validation

All user inputs are validated before backend calls:

```javascript
// In api.js
if (!riskAnalysis || typeof riskAnalysis !== 'object') {
  throw new Error('Invalid risk analysis data');
}
```

### 2. Confirmation Pattern

**All write operations require explicit confirmation:**

- Preview shown first (dry-run)
- User reviews and confirms
- Only then does actual write occur

### 3. HTTPS Only

Forge Custom UI resources are served over HTTPS by default.

---

## 📊 Monitoring

### Track Usage

Add analytics in `App.jsx`:

```javascript
useEffect(() => {
  // Track sidebar view
  if (api.isForgeEnvironment) {
    // Send analytics event
  }
}, []);
```

### Error Tracking

Integrate error tracking service:

```javascript
// In App.jsx
const handleError = (error) => {
  setError(error.message);
  
  // Send to error tracking
  if (window.errorTracker) {
    window.errorTracker.captureException(error);
  }
};
```

---

## 🚀 Performance Optimization

### 1. Code Splitting

Webpack is configured for automatic code splitting. Large components are lazy-loaded:

```javascript
// In App.jsx
const Radar = React.lazy(() => import('./components/Radar'));

// Wrap in Suspense
<Suspense fallback={<div>Loading chart...</div>}>
  <Radar features={features} />
</Suspense>
```

### 2. Caching

Cache risk analysis results:

```javascript
// In api.js
const cache = new Map();

export async function getRiskAnalysis() {
  const cacheKey = 'current-pr';
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const result = await invoke('getRiskAnalysis');
  cache.set(cacheKey, result);
  return result;
}
```

### 3. Debounce Refresh

Prevent rapid refresh clicks:

```javascript
// In App.jsx
const handleRefresh = useCallback(
  debounce(async () => {
    // ... refresh logic
  }, 1000),
  []
);
```

---

## 🐛 Troubleshooting

### Issue: "Failed to load risk analysis"

**Solution:**
1. Check Forge logs: `forge logs`
2. Verify backend functions are deployed
3. Ensure PR context is valid

### Issue: Radar chart not rendering

**Solution:**
1. Check browser console for D3 errors
2. Verify `top_features` data structure
3. Ensure SVG container has dimensions

### Issue: Modal preview empty

**Solution:**
1. Check preview generation in `api.js`
2. Verify action returns `preview` field when `confirm=false`
3. Inspect network tab for API responses

### Issue: Actions disabled

**Solution:**
1. Check if `loading` state is stuck
2. Verify action handlers don't throw errors
3. Review `disabled` prop logic in `ActionsPanel`

---

## 📚 Additional Resources

- [Forge Custom UI Documentation](https://developer.atlassian.com/platform/forge/custom-ui/)
- [Forge Bridge API Reference](https://developer.atlassian.com/platform/forge/apis-reference/ui-bridge/)
- [React Best Practices](https://react.dev/learn)
- [D3.js Documentation](https://d3js.org/)
- [Atlassian Design System](https://atlassian.design/)

---

## ✅ Deployment Checklist

- [ ] Frontend built successfully (`npm run build`)
- [ ] Manifest updated with Custom UI module
- [ ] Bridge functions created and tested
- [ ] Forge app deployed (`forge deploy`)
- [ ] Installation verified in Bitbucket/GitHub
- [ ] PR sidebar appears on test PR
- [ ] All actions work with confirmation flow
- [ ] Error handling tested (invalid inputs, network failures)
- [ ] Accessibility tested (keyboard navigation, screen readers)
- [ ] Performance validated (load time < 3s)

---

## 🎉 You're All Set!

Your Code Risk Radar frontend is now integrated with Forge. Open a PR to see it in action!

**Questions or issues?** Check the troubleshooting section or review the Forge documentation.
