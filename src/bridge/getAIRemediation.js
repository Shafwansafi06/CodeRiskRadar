import Resolver from '@forge/resolver';
import geminiService from '../services/geminiService.js';
import { storage } from '@forge/api';

const resolver = new Resolver();

resolver.define('getAIRemediation', async (req) => {
    const { payload } = req;
    const { prData, riskAnalysis, forceRefresh } = payload;

    console.log('🔧 AI Remediation requested for PR:', prData.prId || prData.id);

    try {
        // Create a content-aware cache key
        const contentHash = `${prData.additions || 0}_${prData.deletions || 0}`;
        const cacheKey = `ai_remediation_v3_${prData.prId || prData.id}_${contentHash}`;

        if (!forceRefresh) {
            const cached = await storage.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 3600000) {
                console.log('✅ Returning cached AI suggestions');
                return cached.data;
            }
        } else {
            console.log('🔄 Force refresh requested - bypassing cache');
        }

        // Generate fresh suggestions
        const result = await geminiService.generateRemediations(prData, riskAnalysis);

        // Cache for 1 hour ONLY if successful
        if (result.success) {
            await storage.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
        }

        return result;

    } catch (error) {
        console.error('❌ Error generating AI remediation:', error);
        return {
            success: false,
            error: error.message,
            suggestions: []
        };
    }
});

export const handler = resolver.getDefinitions();
