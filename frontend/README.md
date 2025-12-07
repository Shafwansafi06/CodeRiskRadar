# Code Risk Radar - Frontend UI

Modern React-based Custom UI for Atlassian Forge displaying risk analysis in PR sidebars.

## Features

- **D3 Radar Visualization** - Interactive radar chart showing risk dimensions
- **Risk Breakdown** - Top features with contribution bars
- **Similar Incidents** - Historical context from Historian agent
- **Actions Panel** - One-click Jira task creation and PR comments
- **Confirmation Modals** - Preview before any write operation
- **Accessibility** - ARIA labels, keyboard navigation, focus management

## Tech Stack

- React 18 (functional components, hooks)
- D3.js for radar visualization
- Forge Custom UI (@forge/react)
- CSS Grid & Flexbox for layout

## Directory Structure

```
frontend/
├── src/
│   ├── App.jsx                    # Main application
│   ├── components/
│   │   ├── Radar.jsx              # D3 radar chart
│   │   ├── RiskBreakdown.jsx      # Feature contributions
│   │   ├── SimilarIncidents.jsx   # Historical matches
│   │   ├── ActionsPanel.jsx       # Action buttons
│   │   └── ConfirmationModal.jsx  # Preview modal
│   ├── api.js                     # Forge API bridge
│   ├── styles.css                 # Styling
│   └── index.jsx                  # Entry point
├── public/
│   └── index.html
├── scripts/
│   └── sample_prs.json            # Mock data
└── package.json
```

## Quick Start

```bash
# Install dependencies
cd frontend
npm install

# Development mode (local mock data)
npm run start

# Production build for Forge
npm run build

# Test in Forge tunnel
forge tunnel
```

## Development

### Local Development
Uses mock data from `scripts/sample_prs.json` when not in Forge environment.

### Forge Development
```bash
forge tunnel
# Opens tunnel, view in Jira/Bitbucket PR sidebar
```

## Accessibility

- ✅ ARIA labels on all interactive elements
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Focus management in modals
- ✅ Screen reader announcements
- ✅ Color contrast WCAG AA compliant

## Components

### Radar.jsx
D3-powered radar chart with:
- Interactive hover tooltips
- Animated transitions
- Responsive sizing
- Accessibility labels

### RiskBreakdown.jsx
Shows top risk features with:
- Contribution percentage bars
- Evidence links to diff viewer
- Expandable details

### SimilarIncidents.jsx
Historical incidents with:
- Similarity scores
- Resolution summaries
- Lessons learned
- Links to Jira tickets

### ActionsPanel.jsx
Action buttons that:
- Call Rovo actions via API
- Show loading states
- Handle errors gracefully
- Require confirmation

## Mock Data Format

See `scripts/sample_prs.json` for complete example structure.

## Build & Deploy

```bash
# Build for production
npm run build

# Deploy to Forge
cd ..
forge deploy
```

## Configuration

Environment detection:
- `window.AP` exists → Forge environment
- No `window.AP` → Local development mode

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
