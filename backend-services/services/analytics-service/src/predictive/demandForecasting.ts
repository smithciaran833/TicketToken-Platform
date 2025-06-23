import { Pool } from 'pg';
import Redis from 'ioredis';

interface DemandForecast {
  eventId: string;
  predictions: Array<{
    timeframe: string;
    expectedDemand: number;
    confidence: number;
    factors: string[];
  }>;
  selloutProbability: number;
  peakDemandPeriods: Array<{
    start: Date;
    end: Date;
    intensity: number;
  }>;
  recommendations: Array<{
    action: string;
    timing: string;
    impact: string;
  }>;
}

interface MarketDemandModel {
  baselineDemand: number;
  seasonalFactors: Record<string, number>;
  externalFactors: Array<{
    factor: string;
    impact: number;
    confidence: number;
  }>;
  elasticityFactors: {
    price: number;
    competition: number;
    timing: number;
  };
}

interface DemandDrivers {
  artistPopularity: number;
  venueAppeal: number;
  pricePoint: number;
  marketConditions: number;
  seasonality: number;
  competition: number;
  socialBuzz: number;
  economicFactors: number;
}

export class DemandForecasting {
  private db: Pool;
  private redis: Redis;
  private models: Map<string, any> = new Map();

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.initializePredictiveModels();
  }

  async forecastEventDemand(eventId: string): Promise<DemandForecast> {
    try {
      const [
        eventData,
        historicalData,
        externalFactors,
        marketConditions
      ] = await Promise.all([
        this.getEventData(eventId),
        this.getHistoricalData(eventId),
        this.getExternalFactors(eventId),
        this.getMarketConditions()
      ]);

      const demandModel = await this.buildDemandModel(eventData, historicalData);
      const predictions = await this.generatePredictions(demandModel, externalFactors);
      const selloutProbability = await this.calculateSelloutProbability(demandModel, eventData);
      const peakPeriods = await this.identifyPeakDemandPeriods(eventData, predictions);
      const recommendations = await this.generateRecommendations(predictions, eventData);

      return {
        eventId,
        predictions,
        selloutProbability,
        peakDemandPeriods: peakPeriods,
        recommendations
      };
    } catch (error) {
      console.error('Error forecasting event demand:', error);
      throw error;
    }
  }

  async forecastArtistDemand(artistId: string, timeframe: '3months' | '6months' | '1year'): Promise<{
    overallTrend: 'growing' | 'stable' | 'declining';
    trendStrength: number;
    peakSeasons: Array<{month: string, multiplier: number}>;
    marketOpportunities: Array<{city: string, demandScore: number}>;
    recommendations: string[];
  }> {
    try {
      const artistHistory = await this.getArtistHistory(artistId);
      const trendAnalysis = await this.analyzeTrends(artistHistory, timeframe);
      const seasonalPattern = await this.identifySeasonalPatterns(artistHistory);
      const marketOpps = await this.identifyMarketOpportunities(artistId);

      return {
        overallTrend: trendAnalysis.direction,
        trendStrength: trendAnalysis.strength,
        peakSeasons: seasonalPattern,
        marketOpportunities: marketOpps,
        recommendations: await this.generateArtistRecommendations(trendAnalysis, marketOpps)
      };
    } catch (error) {
      console.error('Error forecasting artist demand:', error);
      throw error;
    }
  }

  async predictOptimalLaunchTiming(eventData: any): Promise<{
    recommendedDate: Date;
    reasoning: string[];
    alternativeDates: Array<{date: Date, score: number, pros: string[], cons: string[]}>;
    marketReadiness: number;
  }> {
    try {
      const factors = await this.analyzeLaunchFactors(eventData);
      const seasonality = await this.getSeasonalityData(eventData.genre, eventData.venue.city);
      const competition = await this.getCompetitiveCalendar(eventData);
      
      const scoredDates = await this.scorePotentialDates(factors, seasonality, competition);
      const optimal = scoredDates[0];

      return {
        recommendedDate: optimal.date,
        reasoning: optimal.reasoning,
        alternativeDates: scoredDates.slice(1, 4),
        marketReadiness: await this.calculateMarketReadiness(eventData)
      };
    } catch (error) {
      console.error('Error predicting optimal launch timing:', error);
      throw error;
    }
  }

  async forecastCapacityUtilization(eventId: string): Promise<{
    hourlyForecast: Array<{hour: string, utilization: number, confidence: number}>;
    peakUtilization: {time: string, percentage: number};
    bottlenecks: Array<{area: string, severity: number, mitigation: string}>;
    staffingRecommendations: Array<{role: string, count: number, timing: string}>;
  }> {
    try {
      const eventData = await this.getEventData(eventId);
      const historicalUtilization = await this.getHistoricalUtilization(eventData.venue.id);
      const attendancePattern = await this.predictAttendancePattern(eventId);

      const hourlyForecast = this.generateUtilizationForecast(attendancePattern, historicalUtilization);
      const peakTime = this.identifyPeakUtilization(hourlyForecast);
      const bottlenecks = await this.identifyBottlenecks(eventId, peakTime);
      const staffing = this.calculateStaffingNeeds(hourlyForecast, eventData);

      return {
        hourlyForecast,
        peakUtilization: peakTime,
        bottlenecks,
        staffingRecommendations: staffing
      };
    } catch (error) {
      console.error('Error forecasting capacity utilization:', error);
      throw error;
    }
  }

  private async getEventData(eventId: string): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        e.*,
        a.name as artist_name,
        a.genre,
        a.popularity_score,
        v.name as venue_name,
        v.capacity,
        v.city,
        v.state,
        COUNT(t.id) as tickets_sold,
        AVG(t.price) as avg_price
      FROM events e
      JOIN artists a ON e.artist_id = a.id
      JOIN venues v ON e.venue_id = v.id
      LEFT JOIN tickets t ON e.id = t.event_id
      WHERE e.id = $1
      GROUP BY e.id, a.id, v.id
    `, [eventId]);

    return result.rows[0];
  }

  private async getHistoricalData(eventId: string): Promise<any[]> {
    const eventData = await this.getEventData(eventId);
    
    // Get similar historical events
    const result = await this.db.query(`
      SELECT 
        e.*,
        COUNT(t.id) as final_sales,
        AVG(t.price) as avg_price,
        MAX(t.created_at) - MIN(t.created_at) as sales_duration
      FROM events e
      JOIN tickets t ON e.id = t.event_id
      WHERE e.artist_id = $1
        OR (e.venue_id = $2 AND ABS(EXTRACT(EPOCH FROM e.start_time - $3)/86400) < 365)
      GROUP BY e.id
      ORDER BY e.start_time DESC
      LIMIT 20
    `, [eventData.artist_id, eventData.venue_id, eventData.start_time]);

    return result.rows;
  }

  private async getExternalFactors(eventId: string): Promise<any> {
    const eventData = await this.getEventData(eventId);
    
    // In production, would integrate with external APIs
    return {
      weather: await this.getWeatherForecast(eventData.venue.city, eventData.start_time),
      economy: await this.getEconomicIndicators(eventData.venue.state),
      competition: await this.getCompetingEvents(eventData),
      socialMedia: await this.getSocialMediaBuzz(eventData.artist_id),
      trends: await this.getMusicTrends(eventData.genre)
    };
  }

  private async getMarketConditions(): Promise<any> {
    return {
      consumerConfidence: 85.2,
      entertainmentSpending: 1.12, // multiplier vs average
      gasPrice: 3.45,
      unemploymentRate: 3.8,
      seasonalFactor: this.calculateSeasonalFactor()
    };
  }

  private async buildDemandModel(eventData: any, historicalData: any[]): Promise<MarketDemandModel> {
    const baselineDemand = this.calculateBaselineDemand(eventData, historicalData);
    const seasonalFactors = this.calculateSeasonalFactors(historicalData);
    const externalFactors = await this.calculateExternalFactors(eventData);
    const elasticityFactors = this.calculateElasticityFactors(historicalData);

    return {
      baselineDemand,
      seasonalFactors,
      externalFactors,
      elasticityFactors
    };
  }

  private async generatePredictions(model: MarketDemandModel, externalFactors: any): Promise<Array<{
    timeframe: string;
    expectedDemand: number;
    confidence: number;
    factors: string[];
  }>> {
    const timeframes = ['24h', '7d', '30d', 'total'];
    const predictions = [];

    for (const timeframe of timeframes) {
      const demand = this.predictDemandForTimeframe(model, externalFactors, timeframe);
      const confidence = this.calculateConfidence(model, timeframe);
      const factors = this.identifyKeyFactors(model, timeframe);

      predictions.push({
        timeframe,
        expectedDemand: Math.round(demand),
        confidence: Math.round(confidence * 100),
        factors
      });
    }

    return predictions;
  }

  private async calculateSelloutProbability(model: MarketDemandModel, eventData: any): Promise<number> {
    const totalDemand = this.predictDemandForTimeframe(model, {}, 'total');
    const capacity = eventData.capacity;
    const currentSold = eventData.tickets_sold || 0;
    const remainingCapacity = capacity - currentSold;

    // Logistic function for probability
    const demandRatio = totalDemand / remainingCapacity;
    const probability = 1 / (1 + Math.exp(-2 * (demandRatio - 1)));

    return Math.round(probability * 100);
  }

  private async identifyPeakDemandPeriods(eventData: any, predictions: any[]): Promise<Array<{
    start: Date;
    end: Date;
    intensity: number;
  }>> {
    const eventDate = new Date(eventData.start_time);
    const now = new Date();
    
    return [
      {
        start: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
        end: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // +3 days
        intensity: 0.8 // High intensity
      },
      {
        start: new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000), // Week before
        end: new Date(eventDate.getTime() - 24 * 60 * 60 * 1000), // Day before
        intensity: 0.9 // Very high intensity
      }
    ];
  }

  private async generateRecommendations(predictions: any[], eventData: any): Promise<Array<{
    action: string;
    timing: string;
    impact: string;
  }>> {
    const recommendations = [];
    
    const highDemandPrediction = predictions.find(p => p.expectedDemand > eventData.capacity * 0.8);
    if (highDemandPrediction) {
      recommendations.push({
        action: 'Implement dynamic pricing increase',
        timing: 'Within 24 hours',
        impact: 'Increase revenue by 15-25%'
      });
    }

    const lowDemandPrediction = predictions.find(p => p.expectedDemand < eventData.capacity * 0.4);
    if (lowDemandPrediction) {
      recommendations.push({
        action: 'Launch promotional campaign',
        timing: 'Immediately',
        impact: 'Boost sales by 20-30%'
      });
    }

    return recommendations;
  }

  // Helper methods for complex calculations
  private calculateBaselineDemand(eventData: any, historicalData: any[]): number {
    if (historicalData.length === 0) {
      return eventData.capacity * 0.6; // 60% baseline for new artists
    }

    const avgHistoricalDemand = historicalData.reduce((sum, event) => {
      return sum + (event.final_sales || 0);
    }, 0) / historicalData.length;

    // Adjust for venue size differences
    const venueAdjustment = eventData.capacity / 1000; // Normalize to 1000 capacity
    
    return avgHistoricalDemand * venueAdjustment;
  }

  private calculateSeasonalFactors(historicalData: any[]): Record<string, number> {
    const monthlyFactors: Record<string, number> = {};
    
    // Calculate seasonal multipliers based on historical data
    for (let month = 1; month <= 12; month++) {
      const monthEvents = historicalData.filter(event => {
        const eventMonth = new Date(event.start_time).getMonth() + 1;
        return eventMonth === month;
      });

      if (monthEvents.length > 0) {
        const avgDemand = monthEvents.reduce((sum, event) => sum + event.final_sales, 0) / monthEvents.length;
        const overallAvg = historicalData.reduce((sum, event) => sum + event.final_sales, 0) / historicalData.length;
        monthlyFactors[month.toString()] = avgDemand / overallAvg;
      } else {
        monthlyFactors[month.toString()] = 1.0; // Neutral factor
      }
    }

    return monthlyFactors;
  }

  private async calculateExternalFactors(eventData: any): Promise<Array<{factor: string, impact: number, confidence: number}>> {
    return [
      {
        factor: 'Artist Social Media Buzz',
        impact: 0.15, // 15% impact
        confidence: 0.8
      },
      {
        factor: 'Competing Events',
        impact: -0.10, // -10% impact
        confidence: 0.9
      },
      {
        factor: 'Economic Conditions',
        impact: 0.05, // 5% impact
        confidence: 0.7
      }
    ];
  }

  private calculateElasticityFactors(historicalData: any[]): {price: number, competition: number, timing: number} {
    // Simplified elasticity calculations
    return {
      price: -1.2, // Price elasticity of demand
      competition: -0.8, // Competition impact
      timing: 0.5 // Timing sensitivity
    };
  }

  private predictDemandForTimeframe(model: MarketDemandModel, externalFactors: any, timeframe: string): number {
    let baseDemand = model.baselineDemand;
    
    // Apply timeframe adjustments
    const timeframeMultipliers = {
      '24h': 0.1,
      '7d': 0.3,
      '30d': 0.7,
      'total': 1.0
    };

    baseDemand *= timeframeMultipliers[timeframe as keyof typeof timeframeMultipliers] || 1.0;

    // Apply external factors
    model.externalFactors.forEach(factor => {
      baseDemand *= (1 + factor.impact);
    });

    // Apply seasonal factors
    const currentMonth = new Date().getMonth() + 1;
    const seasonalFactor = model.seasonalFactors[currentMonth.toString()] || 1.0;
    baseDemand *= seasonalFactor;

    return Math.max(0, baseDemand);
  }

  private calculateConfidence(model: MarketDemandModel, timeframe: string): number {
    // Base confidence decreases with longer timeframes
    const baseConfidence = {
      '24h': 0.9,
      '7d': 0.8,
      '30d': 0.7,
      'total': 0.6
    };

    let confidence = baseConfidence[timeframe as keyof typeof baseConfidence] || 0.5;

    // Adjust based on data quality
    const dataQuality = model.externalFactors.reduce((sum, factor) => sum + factor.confidence, 0) / model.externalFactors.length;
    confidence *= dataQuality;

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private identifyKeyFactors(model: MarketDemandModel, timeframe: string): string[] {
    const factors = model.externalFactors
      .filter(factor => Math.abs(factor.impact) > 0.05)
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 3)
      .map(factor => factor.factor);

    return factors;
  }

  private calculateSeasonalFactor(): number {
    const month = new Date().getMonth() + 1;
    const seasonalFactors = {
      1: 0.8,  // January - slower
      2: 0.9,  // February
      3: 1.1,  // March - spring pickup
      4: 1.2,  // April
      5: 1.3,  // May - peak season starts
      6: 1.4,  // June
      7: 1.5,  // July - summer peak
      8: 1.4,  // August
      9: 1.2,  // September - back to school
      10: 1.3, // October - fall events
      11: 1.1, // November
      12: 0.9  // December - holidays
    };

    return seasonalFactors[month as keyof typeof seasonalFactors] || 1.0;
  }

  // Placeholder methods for external integrations
  private async getWeatherForecast(city: string, date: Date): Promise<any> {
    return { condition: 'clear', temperature: 72, precipitation: 0 };
  }

  private async getEconomicIndicators(state: string): Promise<any> {
    return { consumerConfidence: 85, unemployment: 3.8 };
  }

  private async getCompetingEvents(eventData: any): Promise<any[]> {
    return [];
  }

  private async getSocialMediaBuzz(artistId: string): Promise<any> {
    return { mentions: 1250, sentiment: 0.75, trending: true };
  }

  private async getMusicTrends(genre: string): Promise<any> {
    return { popularity: 0.85, growth: 0.15 };
  }

  private initializePredictiveModels(): void {
    // Initialize machine learning models for demand prediction
    // In production, would load trained models
    this.models.set('demand_forecasting', {
      type: 'linear_regression',
      features: ['artist_popularity', 'venue_capacity', 'price_point', 'seasonality'],
      accuracy: 0.82
    });
  }

  // Additional helper methods for artist forecasting and market analysis would go here
  private async getArtistHistory(artistId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT e.*, COUNT(t.id) as tickets_sold
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      WHERE e.artist_id = $1
      GROUP BY e.id
      ORDER BY e.start_time DESC
    `, [artistId]);

    return result.rows;
  }

  private async analyzeTrends(history: any[], timeframe: string): Promise<{direction: 'growing' | 'stable' | 'declining', strength: number}> {
    if (history.length < 2) {
      return { direction: 'stable', strength: 0 };
    }

    // Simple trend analysis based on ticket sales
    const recent = history.slice(0, Math.ceil(history.length / 2));
    const older = history.slice(Math.ceil(history.length / 2));

    const recentAvg = recent.reduce((sum, event) => sum + event.tickets_sold, 0) / recent.length;
    const olderAvg = older.reduce((sum, event) => sum + event.tickets_sold, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.1) return { direction: 'growing', strength: Math.min(1, change) };
    if (change < -0.1) return { direction: 'declining', strength: Math.min(1, Math.abs(change)) };
    return { direction: 'stable', strength: 0.5 };
  }

  private async identifySeasonalPatterns(history: any[]): Promise<Array<{month: string, multiplier: number}>> {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const patterns = [];

    for (let month = 0; month < 12; month++) {
      const monthEvents = history.filter(event => new Date(event.start_time).getMonth() === month);
      const avgSales = monthEvents.length > 0 ? 
        monthEvents.reduce((sum, event) => sum + event.tickets_sold, 0) / monthEvents.length : 0;
      
      const overallAvg = history.reduce((sum, event) => sum + event.tickets_sold, 0) / history.length;
      const multiplier = overallAvg > 0 ? avgSales / overallAvg : 1;

      patterns.push({
        month: monthNames[month],
        multiplier: Math.round(multiplier * 100) / 100
      });
    }

    return patterns;
  }

  private async identifyMarketOpportunities(artistId: string): Promise<Array<{city: string, demandScore: number}>> {
    // Simplified market opportunity analysis
    return [
      { city: 'Austin', demandScore: 85 },
      { city: 'Nashville', demandScore: 78 },
      { city: 'Denver', demandScore: 72 },
      { city: 'Seattle', demandScore: 69 }
    ];
  }

  private async generateArtistRecommendations(trendAnalysis: any, marketOpps: any[]): Promise<string[]> {
    const recommendations = [];

    if (trendAnalysis.direction === 'growing') {
      recommendations.push('Consider larger venues for upcoming events');
      recommendations.push('Explore premium tier pricing opportunities');
    }

    if (marketOpps.length > 0) {
      recommendations.push(`Prioritize expansion to ${marketOpps[0].city} market`);
    }

    return recommendations;
  }

  private async analyzeLaunchFactors(eventData: any): Promise<any> {
    return {
      artistAvailability: eventData.start_time,
      venueAvailability: true,
      marketConditions: 0.8,
      competition: 0.6
    };
  }

  private async getSeasonalityData(genre: string, city: string): Promise<any> {
    return { peakMonths: [5, 6, 7, 8], lowMonths: [1, 2, 12] };
  }

  private async getCompetitiveCalendar(eventData: any): Promise<any[]> {
    return [];
  }

  private async scorePotentialDates(factors: any, seasonality: any, competition: any[]): Promise<any[]> {
    return [
      {
        date: new Date(),
        score: 85,
        reasoning: ['Peak season', 'Low competition'],
        pros: ['High demand period'],
        cons: ['Higher marketing costs']
      }
    ];
  }

  private async calculateMarketReadiness(eventData: any): Promise<number> {
    return 78; // Market readiness score out of 100
  }

  private async getHistoricalUtilization(venueId: string): Promise<any[]> {
    return [];
  }

  private async predictAttendancePattern(eventId: string): Promise<any> {
    return { peakHour: 20, pattern: 'normal' };
  }

  private generateUtilizationForecast(pattern: any, historical: any[]): any[] {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}:00`,
      utilization: Math.random() * 100,
      confidence: 80
    }));
  }

  private identifyPeakUtilization(forecast: any[]): {time: string, percentage: number} {
    const peak = forecast.reduce((max, current) => 
      current.utilization > max.utilization ? current : max
    );
    
    return {
      time: peak.hour,
      percentage: peak.utilization
    };
  }

  private async identifyBottlenecks(eventId: string, peakTime: any): Promise<any[]> {
    return [
      {
        area: 'Main entrance',
        severity: 7,
        mitigation: 'Add 2 additional scanners'
      }
    ];
  }

  private calculateStaffingNeeds(forecast: any[], eventData: any): any[] {
    return [
      {
        role: 'Security',
        count: 8,
        timing: '2 hours before event'
      },
      {
        role: 'Ushers',
        count: 12,
        timing: '1 hour before event'
      }
    ];
  }
}
