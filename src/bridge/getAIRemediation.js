import Resolver from '@forge/resolver';
import geminiService from '../services/geminiService.js';
import { storage } from '@forge/api';

const resolver = new Resolver();

resolver.define('getAIRemediation', async (req) => {
    const { payload } = req;
    const { prData, riskAnalysis } = payload;

    console.log('🔧 AI Remediation requested for PR:', prData.prId);

    try {
        // Check cache first (avoid redundant API calls)
        const cacheKey = `ai_remediation_${prData.prId}`;
        const cached = await storage.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < 3600000) {
            console.log('✅ Returning cached AI suggestions');
            return cached.data;
        }

        // Generate fresh suggestions
        const result = await geminiService.generateRemediations(prData, riskAnalysis);

        // Cache for 1 hour
        await storage.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

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
