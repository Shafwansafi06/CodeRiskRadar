#!/bin/bash
# Embeddings Setup & Test Script
# Run this to setup and verify your embeddings system

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Code Risk Radar - Embeddings Setup & Test Script          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: Please run this script from the embeddings/ directory"
    exit 1
fi

# Step 1: Install dependencies
echo "📦 Step 1: Installing Python dependencies..."
pip install -q -r requirements.txt
echo "✅ Dependencies installed"
echo ""

# Step 2: Check environment variables
echo "🔑 Step 2: Checking environment variables..."
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set"
    echo "   Run: export OPENAI_API_KEY='sk-your-key-here'"
else
    echo "✅ OPENAI_API_KEY is set"
fi

if [ -z "$SUPABASE_URL" ]; then
    echo "⚠️  Warning: SUPABASE_URL not set"
    echo "   Run: export SUPABASE_URL='https://your-project.supabase.co'"
else
    echo "✅ SUPABASE_URL is set"
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "⚠️  Warning: SUPABASE_SERVICE_KEY not set"
    echo "   Run: export SUPABASE_SERVICE_KEY='your-service-key'"
else
    echo "✅ SUPABASE_SERVICE_KEY is set"
fi
echo ""

# Step 3: Test embeddings generation
echo "🧠 Step 3: Testing embeddings generation..."
python3 << EOF
try:
    from embeddings_client import EmbeddingsClient, EmbeddingConfig
    config = EmbeddingConfig(anonymize_code=True, hash_sensitive_data=True)
    client = EmbeddingsClient(config)
    
    # Test with sample text
    text = "Fix SQL injection vulnerability in authentication module"
    embedding = client.embed_single(text)
    
    print(f"✅ Generated {len(embedding)}-dimensional embedding")
    print(f"   First 5 values: {embedding[:5]}")
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
EOF
echo ""

# Step 4: Test Supabase connection
echo "🗄️  Step 4: Testing Supabase connection..."
python3 << EOF
try:
    from index_to_supabase import SupabaseIndexer
    indexer = SupabaseIndexer()
    stats = indexer.get_stats()
    print(f"✅ Connected to Supabase")
    print(f"   Total embeddings: {stats['total']}")
    print(f"   By type: {stats['by_type']}")
except Exception as e:
    print(f"❌ Error: {e}")
    print("   Make sure you've run schema.sql in Supabase SQL Editor")
    exit(1)
EOF
echo ""

# Step 5: Test search functionality
echo "🔍 Step 5: Testing search functionality..."
python3 << EOF
try:
    from query_similar import SimilaritySearcher
    searcher = SimilaritySearcher()
    results = searcher.search_by_text("authentication bug", top_k=3)
    print(f"✅ Search working")
    print(f"   Found {len(results)} similar items")
    if results:
        for i, result in enumerate(results[:3], 1):
            print(f"   {i}. {result['source_id']} (similarity: {result['similarity']:.2%})")
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
EOF
echo ""

# Step 6: Index a test PR
echo "📝 Step 6: Indexing a test PR..."
python3 << EOF
try:
    from index_to_supabase import SupabaseIndexer
    
    indexer = SupabaseIndexer()
    
    # Create test PR
    test_pr = {
        "id": 9999,
        "title": "Test PR - Fix authentication vulnerability",
        "description": "This is a test PR to verify embeddings system",
        "repository": {"name": "test-repo", "full_name": "test-org/test-repo"},
        "files": [{"path": "src/auth/login.py"}],
        "diff": "- old_code\n+ new_code"
    }
    
    # Check if already exists
    existing = indexer.check_if_exists("test-org/test-repo/PR-9999")
    if existing:
        print("ℹ️  Test PR already indexed, skipping...")
    else:
        result = indexer.index_pr(test_pr, metadata={"risk_score": 50, "test": True})
        print(f"✅ Indexed test PR: {result['id']}")
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
EOF
echo ""

# Step 7: Search for the test PR
echo "🔎 Step 7: Searching for test PR..."
python3 << EOF
try:
    from query_similar import SimilaritySearcher
    
    searcher = SimilaritySearcher()
    results = searcher.search_by_text(
        "authentication vulnerability",
        match_type="pr",
        top_k=5,
        threshold=0.5
    )
    
    print(f"✅ Found {len(results)} similar PRs")
    for i, result in enumerate(results[:3], 1):
        print(f"   {i}. {result['source_id']} (similarity: {result['similarity']:.2%})")
        if result['metadata'].get('test'):
            print(f"      ⭐ This is the test PR we just indexed!")
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
EOF
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      ✅ SETUP COMPLETE!                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Your embeddings system is ready to use!"
echo ""
echo "📚 Next Steps:"
echo "   1. Review documentation: cat README.md"
echo "   2. Index real PRs: python index_to_supabase.py --help"
echo "   3. Search similar items: python query_similar.py --help"
echo "   4. Integrate with Code Risk Radar: see integration_example.py"
echo ""
echo "🎯 Quick Commands:"
echo "   # Index a PR"
echo "   python index_to_supabase.py --type pr --source-id 'myrepo/PR-123' --content @pr.txt"
echo ""
echo "   # Search similar"
echo "   python query_similar.py --content 'SQL injection bug' --type pr --top-k 5"
echo ""
echo "   # Show statistics"
echo "   python index_to_supabase.py --stats"
echo ""
echo "🔗 Documentation:"
echo "   - Full guide: README.md"
echo "   - Privacy: PRIVACY.md"
echo "   - Architecture: ARCHITECTURE.md"
echo "   - Quick ref: QUICK_REFERENCE.md"
echo ""
echo "Good luck with Codegeist 2025! 🚀"
