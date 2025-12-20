import { storage } from '@forge/api';

/**
 * Team Health Metrics Service
 * Aggregates PR risk data for team-level insights
 */

/**
 * Record PR analysis for team metrics
 */
export async function recordPRMetric(prData, riskAnalysis) {
    try {
        const metrics = await getTeamMetrics();

        const metric = {
            prId: prData.prId,
            title: prData.title,
            author: prData.author,
            riskScore: riskAnalysis.risk_score,
            filesChanged: prData.filesChanged?.length || 0,
            additions: prData.additions || 0,
            deletions: prData.deletions || 0,
            timestamp: Date.now(),
            dayOfWeek: new Date().getDay(),
            hourOfDay: new Date().getHours()
        };

        metrics.push(metric);

        // Keep last 100 PRs
        if (metrics.length > 100) {
            metrics.shift();
        }

        await storage.set('team_metrics', metrics);

        console.log('📊 Team metric recorded:', metric.prId);

    } catch (error) {
        console.error('Failed to record team metric:', error);
    }
}

/**
 * Get team metrics
 */
export async function getTeamMetrics() {
    const metrics = await storage.get('team_metrics');
    return metrics || [];
}

/**
 * Calculate team health score (0-100)
 */
export async function calculateTeamHealth() {
    const metrics = await getTeamMetrics();

    if (metrics.length === 0) {
        return {
            score: 100,
            trend: 'stable',
            message: 'No data yet',
            avgRiskScore: 0,
            totalPRs: 0,
            highRiskPRs: 0
        };
    }

    // Last 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentMetrics = metrics.filter(m => m.timestamp > sevenDaysAgo);

    if (recentMetrics.length === 0) {
        return {
            score: 100,
            trend: 'stable',
            message: 'No recent activity',
            avgRiskScore: 0,
            totalPRs: 0,
            highRiskPRs: 0
        };
    }

    // Average risk score (inverted for health)
    const avgRisk = recentMetrics.reduce((sum, m) => sum + m.riskScore, 0) / recentMetrics.length;
    const healthScore = Math.max(0, 100 - avgRisk);

    // Trend calculation
    const midpoint = Math.floor(recentMetrics.length / 2);
    const firstHalf = recentMetrics.slice(0, midpoint);
    const secondHalf = recentMetrics.slice(midpoint);

    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, m) => sum + m.riskScore, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, m) => sum + m.riskScore, 0) / secondHalf.length : 0;

    let trend = 'stable';
    if (secondAvg > firstAvg + 10) trend = 'declining';
    if (secondAvg < firstAvg - 10) trend = 'improving';

    return {
        score: Math.round(healthScore),
        trend,
        avgRiskScore: Math.round(avgRisk),
        totalPRs: recentMetrics.length,
        highRiskPRs: recentMetrics.filter(m => m.riskScore > 70).length
    };
}

/**
 * Get hot zones (files/components with highest risk)
 */
export async function getHotZones() {
    const metrics = await getTeamMetrics();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentMetrics = metrics.filter(m => m.timestamp > sevenDaysAgo);

    if (recentMetrics.length === 0) {
        return [];
    }

    // Aggregate by file patterns
    const filePatterns = {};

    recentMetrics.forEach(metric => {
        // Use title as pattern if filesChanged not available
        const pattern = metric.title ? metric.title.substring(0, 50) : 'Unknown';

        if (!filePatterns[pattern]) {
            filePatterns[pattern] = {
                pattern,
                count: 0,
                totalRisk: 0,
                prs: []
            };
        }
        filePatterns[pattern].count++;
        filePatterns[pattern].totalRisk += metric.riskScore;
        filePatterns[pattern].prs.push(metric.prId);
    });

    // Sort by average risk
    const hotZones = Object.values(filePatterns)
        .map(zone => ({
            ...zone,
            avgRisk: zone.totalRisk / zone.count
        }))
        .sort((a, b) => b.avgRisk - a.avgRisk)
        .slice(0, 5);

    return hotZones;
}

/**
 * Get risky time windows
 */
export async function getRiskyTimeWindows() {
    const metrics = await getTeamMetrics();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentMetrics = metrics.filter(m => m.timestamp > sevenDaysAgo);

    if (recentMetrics.length === 0) {
        return {
            riskiestDay: { day: 'N/A', avgRisk: 0 },
            riskiestHour: { hour: 'N/A', avgRisk: 0 }
        };
    }

    // Aggregate by day of week and hour
    const timeWindows = {
        byDay: {},
        byHour: {}
    };

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    recentMetrics.forEach(metric => {
        const day = days[metric.dayOfWeek];
        const hour = metric.hourOfDay;

        if (!timeWindows.byDay[day]) {
            timeWindows.byDay[day] = { count: 0, totalRisk: 0 };
        }
        if (!timeWindows.byHour[hour]) {
            timeWindows.byHour[hour] = { count: 0, totalRisk: 0 };
        }

        timeWindows.byDay[day].count++;
        timeWindows.byDay[day].totalRisk += metric.riskScore;
        timeWindows.byHour[hour].count++;
        timeWindows.byHour[hour].totalRisk += metric.riskScore;
    });

    // Find riskiest day and hour
    let riskiestDay = null;
    let maxDayRisk = 0;

    Object.entries(timeWindows.byDay).forEach(([day, data]) => {
        const avgRisk = data.totalRisk / data.count;
        if (avgRisk > maxDayRisk) {
            maxDayRisk = avgRisk;
            riskiestDay = day;
        }
    });

    let riskiestHour = null;
    let maxHourRisk = 0;

    Object.entries(timeWindows.byHour).forEach(([hour, data]) => {
        const avgRisk = data.totalRisk / data.count;
        if (avgRisk > maxHourRisk) {
            maxHourRisk = avgRisk;
            riskiestHour = hour;
        }
    });

    return {
        riskiestDay: { day: riskiestDay || 'N/A', avgRisk: Math.round(maxDayRisk) },
        riskiestHour: { hour: riskiestHour || 'N/A', avgRisk: Math.round(maxHourRisk) }
    };
}

export default {
    recordPRMetric,
    getTeamMetrics,
    calculateTeamHealth,
    getHotZones,
    getRiskyTimeWindows
};
