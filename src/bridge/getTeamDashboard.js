import Resolver from '@forge/resolver';
import teamMetricsService from '../services/teamMetricsService.js';

const resolver = new Resolver();

resolver.define('getTeamDashboard', async (req) => {
    console.log('📊 Team dashboard requested');

    try {
        const [health, hotZones, timeWindows, metrics] = await Promise.all([
            teamMetricsService.calculateTeamHealth(),
            teamMetricsService.getHotZones(),
            teamMetricsService.getRiskyTimeWindows(),
            teamMetricsService.getTeamMetrics()
        ]);

        // Last 30 days for trend chart
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const trendData = metrics
            .filter(m => m.timestamp > thirtyDaysAgo)
            .map(m => ({
                date: new Date(m.timestamp).toISOString().split('T')[0],
                riskScore: m.riskScore
            }));

        return {
            health,
            hotZones,
            timeWindows,
            trendData,
            lastUpdated: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Error fetching team dashboard:', error);
        return {
            error: error.message,
            health: { score: 0, trend: 'unknown', avgRiskScore: 0, totalPRs: 0, highRiskPRs: 0 },
            hotZones: [],
            timeWindows: { riskiestDay: { day: 'N/A', avgRisk: 0 }, riskiestHour: { hour: 'N/A', avgRisk: 0 } },
            trendData: []
        };
    }
});

export const handler = resolver.getDefinitions();
