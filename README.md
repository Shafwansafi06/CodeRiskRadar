# 🎯 PitStop AI — PR Risk Analysis System

[![Atlassian Forge](https://img.shields.io/badge/Powered%20by-Atlassian%20Forge-blue.svg)](https://developer.atlassian.com/platform/forge/)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%202.0-orange.svg)](https://deepmind.google/technologies/gemini/)
[![Privacy First](https://img.shields.io/badge/Privacy-First-green.svg)](#security--privacy)

PitStop AI is a high-performance, privacy-first risk analysis system for Bitbucket Pull Requests. It leverages **Gemini 2.0** and custom **ML heuristics** to provide explainable risk scores, actionable suggestions, and historical context—all without your code ever leaving the Atlassian Forge environment.

---

## ✨ Key Features

- **🚀 Dual-Engine Analysis**: Combines Gemini AI logic with a TF-IDF + Cosine Similarity ML engine.
- **🛡️ Structural Protection**: Automatically flags breaking changes in critical files (Auth, API, Config).
- **📉 Documentation Discount**: Intelligent enough to recognize low-risk documentation-only changes.
- **🔄 Stale-Free Recommendations**: Content-aware caching ensures you always see suggestions for your *latest* code version.
- **🏠 Secure by Design**: Runs entirely on **Runs on Atlassian** (No external network egress required).

---

## 🏗️ System Architecture

PitStop AI operates as an integrated Forge application within the Bitbucket ecosystem.

```mermaid
graph TB
    subgraph "Bitbucket Cloud"
        PR[Pull Request]
        BB_API[Bitbucket API]
    end
    
    subgraph "Atlassian Forge Runtime"
        subgraph "Backend (Node.js 20)"
            Resolver[Forge Resolver]
            ML[ML Service v3<br/>TF-IDF + Cosine]
            Gemini[Gemini AI Service]
            Storage[(Forge Storage)]
        end
        
        subgraph "Frontend (React)"
            UI[React UI Panel]
            Components[UI Components]
        end
    end
    
    PR -->|Open PR| BB_API
    BB_API -->|Request Panel| Resolver
    Resolver --> ML
    Resolver --> Gemini
    ML --> Storage
    Gemini -->|Telemetry| ObservAI[ObservAI SDK]
    Resolver -->|Analysis Results| UI
    UI --> Components
    Components -->|Rendered Panel| PR
```

---

## 🔬 How it Works: The ML Pipeline

We don't just guess risk; we calculate it using a multi-dimensional approach.

```mermaid
flowchart LR
    subgraph "Input"
        PR_Text[PR Title + Description]
        PR_Meta[Metadata additions, deletions, files]
    end
    
    subgraph "Processing"
        TF_IDF[TF-IDF Vectorizer]
        Cosine[Cosine Similarity]
        Heuristics[Structural Heuristics]
    end
    
    subgraph "Validation"
        Benchmarks[(Supabase Benchmarks)]
        Team_DB[(Team History)]
    end
    
    PR_Text --> TF_IDF
    TF_IDF --> Cosine
    Benchmarks --> Cosine
    Team_DB --> Cosine
    
    PR_Meta --> Heuristics
    
    Cosine --> Final[Weighted Risk Score]
    Heuristics --> Final
    
    Final --> UI_Output[Interactive Panel]
```

---

## 🌊 Logic Flow

When you open a PR, PitStop AI springs into action:

```mermaid
sequenceDiagram
    participant User
    participant Bitbucket
    participant Forge
    participant ML as ML Service
    participant Gemini as Gemini AI
    
    User->>Bitbucket: View Pull Request
    Bitbucket->>Forge: Load Risk Panel
    Forge->>Forge: Fetch PR Diff & Metadata
    
    par ML Analysis
        Forge->>ML: Vectorize PR Data
        ML->>ML: Compare vs Benchmark PRs
        ML-->>Forge: Statistical Risk Score
    and AI Analysis
        Forge->>Gemini: Analyze PR Logic
        Gemini-->>Forge: Remediation Suggestions
    end
    
    Forge-->>Bitbucket: Populate Panel
    Bitbucket-->>User: Show Analysis & Recommendations
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/) installed.
- [Bitbucket Cloud](https://bitbucket.org/) workspace.
- [Supabase](https://supabase.com/) project (for benchmarking data).

### 2. Installation

1. **Clone the Repo**
   ```bash
   git clone https://github.com/Shafwansafi06/CodeRiskRadar.git
   cd CodeRiskRadar
   ```

2. **Setup Frontend**
   ```bash
   cd frontend
   npm install && npm run build
   cd ..
   ```

3. **Deploy to Forge**
   ```bash
   forge deploy
   forge install      # Select your Bitbucket site
   ```

4. **Variables Configuration**
   ```bash
   forge variables set SUPABASE_URL your_url
   forge variables set SUPABASE_SERVICE_KEY your_key
   forge variables set GEMINI_API_KEY your_key
   ```

---

## 🔐 Security & Privacy

PitStop AI is designed for enterprise-grade security:
- **No Code Leakage**: Your code diffs are processed in the volatile memory of the Forge runtime.
- **Atlassian Egress**: All outgoing connections are explicitly declared in the `manifest.yml`.
- **Telemetry**: Uses the [ObservAI SDK](https://observai.ai) for secure LLM monitoring without content logging.

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

MIT © 2025 — **PitStop AI** | Created by **Shafwan Safi** 🚀
