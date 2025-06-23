import { Pool } from 'pg';
import Redis from 'ioredis';

interface RevenueProjection {
  eventId: string;
  projections: Array<{
    timeframe: string;
    primaryRevenue: number;
    secondaryRevenue: number;
    totalRevenue: number;
    confidence: number;
  }>;
  milestones: Array<{
    target: number;
    probability: number;
    expectedDate: Date;
  }>;
  riskFactors: Array<{
    factor: string;
    impact: number;
    probability: number;
  }>;
  optimizationOpportunities: Array<{
    opportunity: string;
    potentialUplift: number;
    effort: 'low' | 'medium' | 'high';
  }>;
}

interface ArtistRevenueModel {
  historicalPerformance: Array<{
    year: number;
    totalRevenue: number;
    eventsCount: number;
    avgRevenuePerEvent: number;
  }>;
  growthTrend: {
    direction: 'up' | 'down' | 'stable';
    rate: number;
    confidence: number;
  };
  seasonalPatterns: Record<string, number>;
  marketFactors: Array<{
    factor: string;
    weight: number;
    currentValue: number;
  }>;
}

interface RevenueOptimization {
  currentStrategy: string;
  optimizedStrategy: {
    pricingAdjustments: Array<{tier: string, currentPrice: number, suggestedPrice: number}>;
    timingOptimization: Array<{action: string, timing: string, impact: number}>;
    marketingOptimization: Array<{channel: string, investment: number, expectedReturn: number}>;
  };
  projectedUplift: {
    absolute: number;
    percentage: number;
    timeToRealize: string;
  };
}

export class RevenueProjection {
  private db: Pool;
  private redis: Redis;
  private revenueModels: Map<string, any> = new Map();

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.initializeRevenueModels();
  }

  async projectEventRevenue(eventId: string): Promise<RevenueProjection> {
    try {
      const eventData = await this.getEventData(eventId);
      const historicalData = await this.getHistoricalRevenueData(eventId);
      const marketFactors = await this.getMarketFactors(eventData);
      
      const projections = await this.generateRevenueProjections(eventData, historicalData, marketFactors);
      const milestones = await this.calculateRevenueMilestones(eventData, projections);
      const riskFactors = await this.identifyRevenueRisks(eventData, marketFactors);
      const opportunities = await this.identifyOptimizationOpportunities(eventData, projections);

      return {
        eventId,
        projections,
        milestones,
        riskFactors,
        optimizationOpportunities: opportunities
      };
    } catch (error) {
      console.error('Error projecting event revenue:', error);
      throw error;
    }
  }

  async projectArtistRevenue(artistId: string, timeframe: '6months' | '1year' | '2years'): Promise<{
    totalProjectedRevenue: number;
    revenueByQuarter: Array<{quarter: string, revenue: number, events: number}>;
    growthTrajectory: {
      currentAnnualRevenue: number;
      projectedAnnualRevenue: number;
      growthRate: number;
    };
    recommendations: Array<{
      category: string;
      action: string;
      potentialImpact: number;
      priority: 'high' | 'medium' | 'low';
    }>;
  }> {
    try {
      const artistModel = await this.buildArtistRevenueModel(artistId);
      const projectedQuarters = this.calculateQuarterlyProjections(artistModel, timeframe);
      const growthTrajectory = this.calculateGrowthTrajectory(artistModel);
      const recommendations = await this.generateArtistRecommendations(artistModel, projectedQuarters);

      const totalProjectedRevenue = projectedQuarters.reduce((sum, quarter) => sum + quarter.revenue, 0);

      return {
        totalProjectedRevenue,
        revenueByQuarter: projectedQuarters,
        growthTrajectory,
        recommendations
      };
    } catch (error) {
      console.error('Error projecting artist revenue:', error);
      throw error;
    }
  }

  async optimizeRevenue(eventId: string): Promise<RevenueOptimization> {
    try {
      const eventData = await this.getEventData(eventId);
      const currentRevenue = await this.getCurrentRevenue(eventId);
      const optimization = await this.calculateOptimalStrategy(eventData, currentRevenue);

      return optimization;
    } catch (error) {
      console.error('Error optimizing revenue:', error);
      throw error;
    }
  }

  async simulateRevenueScenarios(eventId: string): Promise<Array<{
    scenario: string;
    assumptions: Record<string, any>;
    projectedRevenue: number;
    probability: number;
    keyDrivers: string[];
  }>> {
    try {
      const baseData = await this.getEventData(eventId);
      
      const scenarios = [
        {
          scenario: 'Best Case',
          assumptions: {
            demandMultiplier: 1.3,
            priceOptimization: 1.15,
            competitionImpact: 0.95
          },
          probability: 15
        },
        {
          scenario: 'Expected Case',
          assumptions: {
            demandMultiplier: 1.0,
            priceOptimization: 1.0,
            competitionImpact: 1.0
          },
          probability: 60
        },
        {
          scenario: 'Conservative Case',
          assumptions: {
            demandMultiplier: 0.8,
            priceOptimization: 0.95,
            competitionImpact: 1.1
          },
          probability: 25
        }
      ];

      const simulatedScenarios = [];
      for (const scenario of scenarios) {
        const projectedRevenue = await this.calculateScenarioRevenue(baseData, scenario.assumptions);
        const keyDrivers = this.identifyScenarioDrivers(scenario.assumptions);

        simulatedScenarios.push({
          scenario: scenario.scenario,
          assumptions: scenario.assumptions,
          projectedRevenue,
          probability: scenario.probability,
          keyDrivers
        });
      }

      return simulatedScenarios;
    } catch (error) {
      console.error('Error simulating revenue scenarios:', error);
      return [];
    }
  }

  async forecastSeasonalRevenue(artistId: string): Promise<{
    monthlyProjections: Array<{month: string, revenue: number, eventsCount: number}>;
    peakSeason: {months: string[], revenueMultiplier: number};
    lowSeason: {months: string[], impact: number};
    yearOverYearGrowth: number;
  }> {
    try {
      const historicalData = await this.getArtistSeasonalData(artistId);
      const monthlyProjections = this.calculateMonthlyProjections(historicalData);
      const seasonalAnalysis = this.analyzeSeasonalPatterns(monthlyProjections);

      return {
        monthlyProjections,
        peakSeason: seasonalAnalysis.peak,
        lowSeason: seasonalAnalysis.low,
        yearOverYearGrowth: seasonalAnalysis.growth
      };
    } catch (error) {
      console.error('Error forecasting seasonal revenue:', error);
      throw error;
    }
  }

  private async getEventData(eventId: string): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        e.*,
        a.name as artist_name,
        a.popularity_score,
        v.capacity,
        v.city,
        v.state,
        COUNT(t.id) as tickets_sold,
        SUM(t.price) as current_revenue,
        AVG(t.price) as avg_ticket_price
      FROM events e
      JOIN artists a ON e.artist_id = a.id
      JOIN venues v ON e.venue_id = v.id
      LEFT JOIN tickets t ON e.id = t.event_id
      WHERE e.id = $1
      GROUP BY e.id, a.id, v.id
    `, [eventId]);

    return result.rows[0];
  }

  private async getHistoricalRevenueData(eventId: string): Promise<any[]> {
    const eventData = await this.getEventData(eventId);
    
    const result = await this.db.query(`
      SELECT 
        e.*,
        SUM(t.price) as total_revenue,
        COUNT(t.id) as tickets_sold,
        AVG(t.price) as avg_price
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      WHERE (e.artist_id = $1 OR e.venue_id = $2)
        AND e.start_time < NOW()
      GROUP BY e.id
      ORDER BY e.start_time DESC
      LIMIT 20
    `, [eventData.artist_id, eventData.venue_id]);

    return result.rows;
  }

  private async getMarketFactors(eventData: any): Promise<any> {
    return {
      seasonality: this.calculateSeasonalFactor(eventData.start_time),
      competition: await this.calculateCompetitionFactor(eventData),
      economy: await this.getEconomicFactors(eventData.state),
      trends: await this.getMusicTrends(eventData.genre)
    };
  }

  private async generateRevenueProjections(eventData: any, historical: any[], marketFactors: any): Promise<Array<{
    timeframe: string;
    primaryRevenue: number;
    secondaryRevenue: number;
    totalRevenue: number;
    confidence: number;
  }>> {
    const timeframes = ['1week', '1month', '3months', 'total'];
    const projections = [];

    for (const timeframe of timeframes) {
      const primaryRevenue = this.projectPrimaryRevenue(eventData, historical, marketFactors, timeframe);
      const secondaryRevenue = this.projectSecondaryRevenue(primaryRevenue, timeframe);
      const totalRevenue = primaryRevenue + secondaryRevenue;
      const confidence = this.calculateProjectionConfidence(timeframe, historical.length);

      projections.push({
        timeframe,
        primaryRevenue: Math.round(primaryRevenue),
        secondaryRevenue: Math.round(secondaryRevenue),
        totalRevenue: Math.round(totalRevenue),
        confidence: Math.round(confidence * 100)
      });
    }

    return projections;
  }

  private async calculateRevenueMilestones(eventData: any, projections: any[]): Promise<Array<{
    target: number;
    probability: number;
    expectedDate: Date;
  }>> {
    const totalProjection = projections.find(p => p.timeframe === 'total');
    if (!totalProjection) return [];

    const targets = [
      eventData.capacity * 25,  // 25% capacity revenue
      eventData.capacity * 50,  // 50% capacity revenue
      eventData.capacity * 75,  // 75% capacity revenue
      eventData.capacity * 100  // Sellout revenue
    ];

    return targets.map((target, index) => {
      const probability = Math.max(10, 100 - (index * 20) - Math.random() * 20);
      const daysFromNow = (index + 1) * 7; // Staggered milestones
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + daysFromNow);

      return {
        target,
        probability: Math.round(probability),
        expectedDate
      };
    });
  }

  private async identifyRevenueRisks(eventData: any, marketFactors: any): Promise<Array<{
    factor: string;
    impact: number;
    probability: number;
  }>> {
    return [
      {
        factor: 'Economic downturn affecting discretionary spending',
        impact: -0.15,
        probability: 0.2
      },
      {
        factor: 'Competing major events in same timeframe',
        impact: -0.25,
        probability: 0.3
      },
      {
        factor: 'Weather-related attendance issues',
        impact: -0.10,
        probability: 0.15
      },
      {
        factor: 'Artist cancellation or postponement',
        impact: -0.80,
        probability: 0.05
      }
    ];
  }

  private async identifyOptimizationOpportunities(eventData: any, projections: any[]): Promise<Array<{
    opportunity: string;
    potentialUplift: number;
    effort: 'low' | 'medium' | 'high';
  }>> {
    const opportunities = [];
    
    const currentRevenue = eventData.current_revenue || 0;
    const projectedRevenue = projections.find(p => p.timeframe === 'total')?.totalRevenue || 0;

    if (projectedRevenue > currentRevenue * 1.2) {
      opportunities.push({
        opportunity: 'Implement dynamic pricing for high-demand periods',
        potentialUplift: 0.15,
        effort: 'medium'
      });
    }

    if (eventData.tickets_sold < eventData.capacity * 0.6) {
      opportunities.push({
        opportunity: 'Launch targeted marketing campaign',
        potentialUplift: 0.20,
        effort: 'high'
      });
    }

    opportunities.push({
      opportunity: 'Enable premium add-on experiences',
      potentialUplift: 0.12,
      effort: 'medium'
    });

    return opportunities;
  }

  private async buildArtistRevenueModel(artistId: string): Promise<ArtistRevenueModel> {
    const historicalPerformance = await this.getArtistHistoricalPerformance(artistId);
    const growthTrend = this.calculateGrowthTrend(historicalPerformance);
    const seasonalPatterns = await this.calculateSeasonalPatterns(artistId);
    const marketFactors = await this.getArtistMarketFactors(artistId);

    return {
      historicalPerformance,
      growthTrend,
      seasonalPatterns,
      marketFactors
    };
  }

  private projectPrimaryRevenue(eventData: any, historical: any[], marketFactors: any, timeframe: string): number {
    // Base revenue from current sales
    let baseRevenue = eventData.current_revenue || 0;
    
    // Historical average adjustment
    if (historical.length > 0) {
      const avgHistoricalRevenue = historical.reduce((sum, event) => sum + (event.total_revenue || 0), 0) / historical.length;
      const capacityAdjustment = eventData.capacity / 1000; // Normalize to 1000 capacity
      baseRevenue = Math.max(baseRevenue, avgHistoricalRevenue * capacityAdjustment);
    }

    // Apply market factors
    baseRevenue *= marketFactors.seasonality;
    baseRevenue *= (1 - marketFactors.competition * 0.1);
    baseRevenue *= marketFactors.economy;

    // Apply timeframe adjustments
    const timeframeMultipliers = {
      '1week': 0.2,
      '1month': 0.6,
      '3months': 0.9,
      'total': 1.0
    };

    return baseRevenue * (timeframeMultipliers[timeframe as keyof typeof timeframeMultipliers] || 1.0);
  }

  private projectSecondaryRevenue(primaryRevenue: number, timeframe: string): number {
    // Secondary market typically generates 10-15% of primary revenue
    const secondaryRate = 0.12;
    
    // Secondary market develops over time
    const timeframeMultipliers = {
      '1week': 0.1,
      '1month': 0.4,
      '3months': 0.8,
      'total': 1.0
    };

    const multiplier = timeframeMultipliers[timeframe as keyof typeof timeframeMultipliers] || 1.0;
    return primaryRevenue * secondaryRate * multiplier;
  }

  private calculateProjectionConfidence(timeframe: string, historicalDataPoints: number): number {
    const baseConfidence = {
      '1week': 0.85,
      '1month': 0.75,
      '3months': 0.65,
      'total': 0.60
    };

    let confidence = baseConfidence[timeframe as keyof typeof baseConfidence] || 0.5;
    
    // Adjust for data quality
    const dataQualityFactor = Math.min(1.0, historicalDataPoints / 10);
    confidence *= (0.7 + 0.3 * dataQualityFactor);

    return confidence;
  }

  private calculateSeasonalFactor(eventDate: Date): number {
    const month = eventDate.getMonth() + 1;
    const seasonalFactors = {
      1: 0.8, 2: 0.9, 3: 1.1, 4: 1.2, 5: 1.3, 6: 1.4,
      7: 1.5, 8: 1.4, 9: 1.2, 10: 1.3, 11: 1.1, 12: 0.9
    };

    return seasonalFactors[month as keyof typeof seasonalFactors] || 1.0;
  }

  private async calculateCompetitionFactor(eventData: any): Promise<number> {
    // Simplified competition calculation
    return 0.15; // 15% competition impact
  }

  private async getEconomicFactors(state: string): Promise<number> {
    // Simplified economic factor
    return 1.05; // 5% positive economic environment
  }

  private async getMusicTrends(genre: string): Promise<number> {
    // Simplified music trend factor
    const trendFactors = {
      'Electronic': 1.15,
      'Hip-Hop': 1.10,
      'Rock': 0.95,
      'Pop': 1.05,
      'Country': 1.00
    };

    return trendFactors[genre as keyof typeof trendFactors] || 1.0;
  }

  private async getCurrentRevenue(eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT SUM(price) as current_revenue
      FROM tickets
      WHERE event_id = $1
    `, [eventId]);

    return parseFloat(result.rows[0]?.current_revenue || '0');
  }

  private async calculateOptimalStrategy(eventData: any, currentRevenue: number): Promise<RevenueOptimization> {
    return {
      currentStrategy: 'Standard pricing with fixed tiers',
      optimizedStrategy: {
        pricingAdjustments: [
          {tier: 'GA', currentPrice: 50, suggestedPrice: 55},
          {tier: 'VIP', currentPrice: 150, suggestedPrice: 175}
        ],
        timingOptimization: [
          {action: 'Early bird pricing', timing: 'Launch immediately', impact: 0.1},
          {action: 'Last week surge', timing: '7 days before event', impact: 0.15}
        ],
        marketingOptimization: [
          {channel: 'Social media ads', investment: 5000, expectedReturn: 15000},
          {channel: 'Email marketing', investment: 1000, expectedReturn: 8000}
        ]
      },
      projectedUplift: {
        absolute: currentRevenue * 0.25,
        percentage: 25,
        timeToRealize: '30 days'
      }
    };
  }

  private async calculateScenarioRevenue(baseData: any, assumptions: any): Promise<number> {
    let baseRevenue = baseData.capacity * 75; // Assume $75 average ticket price
    
    baseRevenue *= assumptions.demandMultiplier;
    baseRevenue *= assumptions.priceOptimization;
    baseRevenue *= (2 - assumptions.competitionImpact); // Inverse impact

    return Math.round(baseRevenue);
  }

  private identifyScenarioDrivers(assumptions: any): string[] {
    const drivers = [];
    
    if (assumptions.demandMultiplier > 1.1) drivers.push('High fan demand');
    if (assumptions.priceOptimization > 1.05) drivers.push('Optimized pricing strategy');
    if (assumptions.competitionImpact < 0.95) drivers.push('Limited competition');

    return drivers;
  }

  private calculateQuarterlyProjections(model: ArtistRevenueModel, timeframe: string): Array<{quarter: string, revenue: number, events: number}> {
    const quarters = timeframe === '6months' ? 2 : timeframe === '1year' ? 4 : 8;
    const projections = [];

    for (let i = 0; i < quarters; i++) {
      const quarterRevenue = this.calculateQuarterRevenue(model, i);
      const events = Math.ceil(quarterRevenue / 100000); // Assume $100k average per event

      projections.push({
        quarter: `Q${(i % 4) + 1} ${new Date().getFullYear() + Math.floor(i / 4)}`,
        revenue: Math.round(quarterRevenue),
        events
      });
    }

    return projections;
  }

  private calculateQuarterRevenue(model: ArtistRevenueModel, quarterIndex: number): number {
    // Simplified quarterly calculation
    const baseQuarterlyRevenue = 300000; // $300k base
    const growthFactor = Math.pow(1 + model.growthTrend.rate, quarterIndex / 4);
    const seasonalFactor = this.getQuarterSeasonalFactor(quarterIndex % 4);

    return baseQuarterlyRevenue * growthFactor * seasonalFactor;
  }

  private getQuarterSeasonalFactor(quarter: number): number {
    const factors = [0.9, 1.1, 1.3, 1.0]; // Q1, Q2, Q3, Q4
    return factors[quarter] || 1.0;
  }

  private calculateGrowthTrajectory(model: ArtistRevenueModel): any {
    const currentAnnual = model.historicalPerformance[0]?.totalRevenue || 0;
    const projectedAnnual = currentAnnual * (1 + model.growthTrend.rate);

    return {
      currentAnnualRevenue: currentAnnual,
      projectedAnnualRevenue: Math.round(projectedAnnual),
      growthRate: Math.round(model.growthTrend.rate * 100)
    };
  }

  private async generateArtistRecommendations(model: ArtistRevenueModel, projections: any[]): Promise<any[]> {
    const recommendations = [];

    if (model.growthTrend.direction === 'up') {
      recommendations.push({
        category: 'Pricing',
        action: 'Consider premium tier expansion',
        potentialImpact: 0.15,
        priority: 'high' as const
      });
    }

    recommendations.push({
      category: 'Market Expansion',
      action: 'Enter high-demand markets',
      potentialImpact: 0.25,
      priority: 'medium' as const
    });

    return recommendations;
  }

  private initializeRevenueModels(): void {
    this.revenueModels.set('primary_sales', {
      type: 'time_series',
      accuracy: 0.78,
      features: ['historical_sales', 'market_factors', 'seasonality']
    });

    this.revenueModels.set('secondary_sales', {
      type: 'regression',
      accuracy: 0.65,
      features: ['primary_volume', 'event_demand', 'time_to_event']
    });
  }

  // Additional helper methods
  private async getArtistHistoricalPerformance(artistId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        EXTRACT(YEAR FROM e.start_time) as year,
        SUM(t.price) as total_revenue,
        COUNT(DISTINCT e.id) as events_count,
        AVG(t.price) as avg_revenue_per_ticket
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      WHERE e.artist_id = $1
      GROUP BY EXTRACT(YEAR FROM e.start_time)
      ORDER BY year DESC
    `, [artistId]);

    return result.rows.map(row => ({
      year: parseInt(row.year),
      totalRevenue: parseFloat(row.total_revenue || '0'),
      eventsCount: parseInt(row.events_count),
      avgRevenuePerEvent: parseFloat(row.total_revenue || '0') / parseInt(row.events_count)
    }));
  }

  private calculateGrowthTrend(performance: any[]): any {
    if (performance.length < 2) {
      return { direction: 'stable', rate: 0, confidence: 0.5 };
    }

    const recent = performance[0];
    const previous = performance[1];
    const growthRate = (recent.totalRevenue - previous.totalRevenue) / previous.totalRevenue;

    return {
      direction: growthRate > 0.05 ? 'up' : growthRate < -0.05 ? 'down' : 'stable',
      rate: growthRate,
      confidence: performance.length > 3 ? 0.8 : 0.6
    };
  }

  private async calculateSeasonalPatterns(artistId: string): Promise<Record<string, number>> {
    // Simplified seasonal calculation
    return {
      '1': 0.8, '2': 0.9, '3': 1.1, '4': 1.2, '5': 1.3, '6': 1.4,
      '7': 1.5, '8': 1.4, '9': 1.2, '10': 1.3, '11': 1.1, '12': 0.9
    };
  }

  private async getArtistMarketFactors(artistId: string): Promise<any[]> {
    return [
      { factor: 'Genre popularity', weight: 0.3, currentValue: 0.85 },
      { factor: 'Social media following', weight: 0.25, currentValue: 0.9 },
      { factor: 'Recent releases', weight: 0.2, currentValue: 0.75 }
    ];
  }

  private async getArtistSeasonalData(artistId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        EXTRACT(MONTH FROM e.start_time) as month,
        COUNT(DISTINCT e.id) as events,
        SUM(t.price) as revenue
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      WHERE e.artist_id = $1
      GROUP BY EXTRACT(MONTH FROM e.start_time)
      ORDER BY month
    `, [artistId]);

    return result.rows;
  }

  private calculateMonthlyProjections(historicalData: any[]): Array<{month: string, revenue: number, eventsCount: number}> {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return months.map((month, index) => {
      const monthData = historicalData.find(d => parseInt(d.month) === index + 1);
      return {
        month,
        revenue: Math.round(parseFloat(monthData?.revenue || '0') * 1.1), // 10% growth assumption
        eventsCount: parseInt(monthData?.events || '0')
      };
    });
  }

  private analyzeSeasonalPatterns(projections: any[]): any {
    const revenues = projections.map(p => p.revenue);
    const maxRevenue = Math.max(...revenues);
    const minRevenue = Math.min(...revenues);
    
    const peakMonths = projections
      .filter(p => p.revenue > maxRevenue * 0.8)
      .map(p => p.month);
    
    const lowMonths = projections
      .filter(p => p.revenue < maxRevenue * 0.6)
      .map(p => p.month);

    return {
      peak: {
        months: peakMonths,
        revenueMultiplier: maxRevenue / (revenues.reduce((a, b) => a + b, 0) / revenues.length)
      },
      low: {
        months: lowMonths,
        impact: 1 - (minRevenue / maxRevenue)
      },
      growth: 0.15 // 15% year-over-year growth assumption
    };
  }
}
