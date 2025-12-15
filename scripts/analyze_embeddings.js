/**
 * Analyze PR Embeddings from Top Companies
 * Query Supabase to understand embedding data structure
 */

const SUPABASE_URL = 'https://gbesjxveinhjnfnlushe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZXNqeHZlaW5oam5mbmx1c2hlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyOTM5MSwiZXhwIjoyMDgxMTA1MzkxfQ.kL81VWhJu9LhaGZoLuMxqLb6hNcilwo5ruQ64Fdzs8Y';

async function query(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    throw new Error(`Query failed: ${response.status} ${await response.text()}`);
  }
  
  return await response.json();
}

async function analyze() {
  console.log('🔍 Analyzing PR Embeddings from Top Companies\n');
  
  // 1. Check what tables we have
  console.log('📊 Available Tables:');
  const tables = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_KEY}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  }).then(r => r.json());
  console.log(tables);
  
  // 2. Check prs table structure
  console.log('\n📋 PRs Table Sample:');
  const prs = await fetch(`${SUPABASE_URL}/rest/v1/prs?select=*&limit=3`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  }).then(r => r.json());
  console.log(JSON.stringify(prs, null, 2));
  
  // 3. Check if we have company/organization info
  console.log('\n🏢 Checking for company/organization data:');
  const withOrg = await fetch(`${SUPABASE_URL}/rest/v1/prs?select=doc_id,title&limit=50`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  }).then(r => r.json());
  
  const companies = new Set();
  if (Array.isArray(withOrg)) {
    withOrg.forEach(pr => {
      if (pr.doc_id) {
        const org = pr.doc_id.split('/')[0];
        companies.add(org);
      }
    });
  }
  console.log('Found companies/orgs:', Array.from(companies).slice(0, 20));
  
  // 4. Check embeddings table
  console.log('\n🧠 Embeddings Table:');
  const embeddings = await fetch(`${SUPABASE_URL}/rest/v1/embeddings?select=*&limit=2`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  }).then(r => r.json());
  
  if (embeddings.length > 0) {
    console.log(`- Total embeddings: ${embeddings.length}`);
    console.log(`- Sample embedding dimensions: ${embeddings[0].embedding ? embeddings[0].embedding.length : 'N/A'}`);
    console.log(`- Sample structure:`, Object.keys(embeddings[0]));
  }
  
  // 5. Check chunked_embeddings
  console.log('\n📦 Chunked Embeddings Table:');
  const chunked = await fetch(`${SUPABASE_URL}/rest/v1/chunked_embeddings?select=*&limit=2`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  }).then(r => r.json());
  
  if (chunked.length > 0) {
    console.log(`- Sample structure:`, Object.keys(chunked[0]));
    console.log(`- Sample data:`, JSON.stringify(chunked[0], null, 2).substring(0, 500));
  }
  
  // 6. Look for high-quality PRs
  console.log('\n⭐ High Quality PRs (merged, no issues):');
  const highQuality = await fetch(`${SUPABASE_URL}/rest/v1/prs?select=*&state=eq.merged&limit=5&order=created_at.desc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  }).then(r => r.json());
  
  highQuality.forEach(pr => {
    console.log(`- ${pr.title} (${pr.repository_url})`);
  });
}

analyze().catch(console.error);
