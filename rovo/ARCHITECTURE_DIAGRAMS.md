# Rovo Integration Architecture Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Code Risk Radar System                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Rovo Integration Layer                        │
│                                                                   │
│  ┌──────────────┐           ┌──────────────┐                    │
│  │ RiskAnalyst  │           │  Historian   │                    │
│  │    Agent     │           │    Agent     │                    │
│  └──────────────┘           └──────────────┘                    │
│         │                           │                            │
│         └───────────┬───────────────┘                            │
│                     ▼                                            │
│  ┌─────────────────────────────────────────────┐                │
│  │          Action Handlers                     │                │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │                │
│  │  │  Jira    │  │    PR    │  │   Fix    │  │                │
│  │  │  Task    │  │ Comment  │  │ Branch   │  │                │
│  │  └──────────┘  └──────────┘  └──────────┘  │                │
│  └─────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│     Jira     │      │    GitHub    │     │   Supabase   │
│   (Tasks)    │      │    (PRs)     │     │ (Embeddings) │
└──────────────┘      └──────────────┘     └──────────────┘
```

---

## Data Flow: Risk Analysis

```
┌──────────────┐
│  Code Change │
│  (PR/Commit) │
└──────┬───────┘
       │
       ▼
┌────────────────────────────────────────┐
│  Extract Features                      │
│  • risk_score                          │
│  • top_features                        │
│  • diff_snippet                        │
│  • embedding_vector (optional)         │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  RiskAnalyst Agent                     │
│  • Parse input                         │
│  • Format prompt                       │
│  • Invoke Rovo agent                   │
│  • Parse JSON response                 │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  Risk Analysis Result                  │
│  {                                     │
│    "explanation": "...",               │
│    "risk_level": "critical",           │
│    "actions": [...]                    │
│  }                                     │
└────────┬───────────────────────────────┘
         │
         ├─────────────────┬─────────────┐
         ▼                 ▼             ▼
┌────────────────┐  ┌───────────┐  ┌──────────┐
│  Create Jira   │  │   Post    │  │  Create  │
│     Task       │  │    PR     │  │   Fix    │
│   (preview)    │  │  Comment  │  │  Branch  │
└────────────────┘  └───────────┘  └──────────┘
```

---

## Historical Context Query Flow

```
┌──────────────────┐
│  Code Embedding  │
│  (768-dim vector)│
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  Historian Agent                       │
│  Option 1: Direct Supabase Query       │
│  Option 2: Rovo Agent with Context     │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  Supabase Vector Search                │
│  • match_code_embeddings()             │
│  • Similarity threshold: 0.7           │
│  • Top 5 matches                       │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  Similar Incidents                     │
│  [                                     │
│    {                                   │
│      "id": "INC-001",                  │
│      "summary": "...",                 │
│      "similarity": 0.92,               │
│      "resolution": "...",              │
│      "lessons": [...]                  │
│    }                                   │
│  ]                                     │
└────────────────────────────────────────┘
```

---

## Action Execution Flow (Dry-Run Pattern)

```
┌──────────────┐
│ Action Input │
│ confirm=false│
└──────┬───────┘
       │
       ▼
┌────────────────────────────┐
│  Validate Input            │
│  • Check required fields   │
│  • Sanitize inputs         │
│  • Validate formats        │
└──────┬─────────────────────┘
       │
       ▼
┌────────────────────────────┐
│  Build Action Payload      │
│  • Jira issue structure    │
│  • PR comment markdown     │
│  • Branch/PR details       │
└──────┬─────────────────────┘
       │
       ▼
   ┌───┴───┐
   │confirm│
   │=false?│
   └───┬───┘
       │
  Yes  │  No
   ┌───┴───┐
   ▼       ▼
┌─────┐ ┌──────────────────┐
│Show │ │  Execute Action  │
│Pre- │ │  • Call API      │
│view │ │  • Create resource│
└─────┘ │  • Log audit     │
        └──────┬───────────┘
               │
               ▼
        ┌──────────────┐
        │   Return     │
        │   Result     │
        └──────────────┘
```

---

## Full Workflow Architecture

```
┌────────────────────────────────────────────────────────┐
│                   fullWorkflow()                        │
└────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│Risk Analysis │ │   History    │ │   Actions    │
│  (Required)  │ │  (Optional)  │ │  (Optional)  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       │   Parallel     │                │
       │   Execution    │                │
       └────────┬───────┘                │
                │                        │
                ▼                        │
        ┌───────────────┐                │
        │   Combined    │                │
        │   Analysis    │                │
        └───────┬───────┘                │
                │                        │
                │  Sequential            │
                │  if enabled            │
                └────────┬───────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Create Jira  │ │  Post PR     │ │ Create Fix   │
│    Task      │ │  Comment     │ │   Branch     │
│   (if flag)  │ │   (if flag)  │ │  (if flag)   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │  Aggregated   │
                │    Results    │
                │  {            │
                │   analysis,   │
                │   jira_task,  │
                │   pr_comment, │
                │   errors      │
                │  }            │
                └───────────────┘
```

---

## Batch Processing Architecture

```
┌────────────────────────────────────────┐
│  processBatch(changes[], options)      │
└────────────────┬───────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │  Split into   │
         │   Chunks      │
         │ (concurrency) │
         └───────┬───────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│Chunk 1 │  │Chunk 2 │  │Chunk 3 │
│(3 files│  │(3 files│  │(3 files│
└────┬───┘  └────┬───┘  └────┬───┘
     │           │           │
     │  Parallel │           │
     │  Process  │           │
     └─────┬─────┴─────┬─────┘
           │           │
           ▼           ▼
    ┌──────────────────────┐
    │  fullWorkflow() x N  │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │  Aggregate Results   │
    │  • Successful        │
    │  • Failed            │
    │  • Errors            │
    └──────────────────────┘
```

---

## Safety Mechanisms

```
┌─────────────────────────────────────────────────┐
│              Safety Layer                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  1. Input Validation                            │
│     ┌──────────────────────────────────┐        │
│     │ • Type checking                  │        │
│     │ • Format validation              │        │
│     │ • Sanitization                   │        │
│     │ • Length limits                  │        │
│     └──────────────────────────────────┘        │
│                                                  │
│  2. Dry-Run Pattern                             │
│     ┌──────────────────────────────────┐        │
│     │ confirm=false → Preview          │        │
│     │ confirm=true  → Execute          │        │
│     └──────────────────────────────────┘        │
│                                                  │
│  3. Manual Confirmation                         │
│     ┌──────────────────────────────────┐        │
│     │ createFixBranchPR:               │        │
│     │   REQUIRES confirm === true      │        │
│     │   (strict equality)              │        │
│     └──────────────────────────────────┘        │
│                                                  │
│  4. Audit Logging                               │
│     ┌──────────────────────────────────┐        │
│     │ • Action type                    │        │
│     │ • Timestamp                      │        │
│     │ • User context                   │        │
│     │ • Result                         │        │
│     └──────────────────────────────────┘        │
│                                                  │
│  5. Error Handling                              │
│     ┌──────────────────────────────────┐        │
│     │ • Retry with backoff             │        │
│     │ • Graceful degradation           │        │
│     │ • Detailed error messages        │        │
│     │ • Fallback responses             │        │
│     └──────────────────────────────────┘        │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Integration Patterns

### Pattern 1: GitHub Webhook Integration

```
GitHub Event
    │
    ▼
┌──────────────┐
│   Webhook    │
│   Handler    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Extract PR Info  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  ML Pipeline     │
│  • Risk score    │
│  • Features      │
│  • Embeddings    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  fullWorkflow()  │
└──────┬───────────┘
       │
       ├─────────────┬─────────────┐
       ▼             ▼             ▼
   Analysis    Jira Task     PR Comment
```

### Pattern 2: CI/CD Pipeline Integration

```
Git Push
    │
    ▼
┌──────────────┐
│  CI/CD Run   │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Checkout Code   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Run Analysis    │
│  Script          │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  processBatch()  │
│  All Changes     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Generate Report  │
│ Post to PR       │
└──────────────────┘
```

### Pattern 3: Interactive CLI

```
User Input
    │
    ▼
┌──────────────────┐
│  File Selection  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  analyzeRisk()   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Display Results  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ User Choice Menu │
│ 1. Jira Task     │
│ 2. PR Comment    │
│ 3. Fix Branch    │
│ 4. Exit          │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ executeAction()  │
│ (with confirm)   │
└──────────────────┘
```

---

## Component Dependencies

```
rovoIntegration.js
    │
    ├── rovo/riskAgent.js
    │       │
    │       └── @forge/api (invoke)
    │
    ├── rovo/historianAgent.js
    │       │
    │       ├── @forge/api (invoke)
    │       └── @supabase/supabase-js (optional)
    │
    └── actions/
            │
            ├── createJiraTask.js
            │       │
            │       └── @forge/api (requestJira, storage)
            │
            ├── postPRComment.js
            │       │
            │       ├── @forge/api (storage)
            │       └── node-fetch (GitHub API)
            │
            └── createFixBranchPR.js
                    │
                    ├── @forge/api (storage)
                    └── node-fetch (GitHub API)
```

---

## Error Handling Flow

```
┌──────────────┐
│ Try Execute  │
└──────┬───────┘
       │
       ▼
   Success?
       │
   ┌───┴───┐
 Yes│     │No
   ▼     ▼
┌────┐ ┌──────────────┐
│Done│ │ Error Type?  │
└────┘ └──────┬───────┘
              │
    ┌─────────┼─────────┬──────────┐
    ▼         ▼         ▼          ▼
┌────────┐ ┌─────┐ ┌────────┐ ┌────────┐
│Timeout │ │Rate │ │Network │ │Other   │
└────┬───┘ │Limit│ └────┬───┘ └────┬───┘
     │     └──┬──┘      │          │
     │        │         │          │
     ▼        ▼         ▼          ▼
┌──────────────────────────────────────┐
│         Retry Logic                  │
│  • Exponential backoff               │
│  • Max retries: 2                    │
│  • Delay: 2^attempt * 1000ms         │
└──────┬───────────────────────────────┘
       │
       ▼
   Max Retries
   Exceeded?
       │
   ┌───┴───┐
 Yes│     │No
   ▼     ▼
┌────┐ ┌──────┐
│Fail│ │Retry │
│with│ └──────┘
│Fall│
│back│
└────┘
```

---

## Prompt Variant Selection Logic

```
┌────────────────┐
│  Context Info  │
│  • Team exp    │
│  • Incidents   │
│  • Risk domain │
│  • Velocity    │
└────────┬───────┘
         │
         ▼
┌────────────────────┐
│  Calculate Score   │
│  risk_score = 0    │
│  + incidents * 30  │
│  + exp_factor      │
│  + domain_factor   │
│  + velocity_factor │
└────────┬───────────┘
         │
         ▼
    Score Range?
         │
  ┌──────┼──────┐
  ▼      ▼      ▼
<30    30-60   >60
  │      │      │
  ▼      ▼      ▼
┌────┐ ┌────┐ ┌────┐
│Con-│ │Bal-│ │Agg-│
│ser-│ │anced│ │res-│
│va- │ │    │ │sive│
│tive│ │    │ │    │
└────┘ └────┘ └────┘
  │      │      │
  └──────┼──────┘
         ▼
  ┌──────────────┐
  │ Use Prompt   │
  │   Variant    │
  └──────────────┘
```

---

These diagrams illustrate the complete architecture and data flows of the Rovo integration system.
