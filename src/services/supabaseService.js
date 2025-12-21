import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials missing. ML benchmarking will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch top matching quality PRs from industry benchmark
 */
export async function getBenchmarkPRs(metrics, limit = 10) {
    try {
        const additions = Number(metrics.additions) || 0;
        const deletions = Number(metrics.deletions) || 0;
        const changed_files = Number(metrics.changed_files) || 0;

        // Find PRs with similar scale (+/- 50% lines)
        const { data, error } = await supabase
            .from('prs')
            .select('*, projects(owner, repo)')
            .gte('additions', Math.round(additions * 0.5))
            .lte('additions', Math.round(additions * 1.5))
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        console.log(`🌐 Supabase: Found ${data?.length || 0} benchmark PRs`);
        return data || [];
    } catch (error) {
        console.error('❌ Supabase error:', error.message);
        return [];
    }
}

/**
 * Fetch risky PR patterns
 */
export async function getRiskyPatterns(limit = 5) {
    try {
        // In a real scenario, we might query by labels or past metrics
        const { data, error } = await supabase
            .from('prs')
            .select('*')
            .not('title', 'is', null)
            .ilike('title', '%bug%') // Example: search for buggy PRs
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Supabase Risky error:', error.message);
        return [];
    }
}
