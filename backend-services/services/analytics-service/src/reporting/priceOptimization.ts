import { Pool } from 'pg';
import Redis from 'ioredis';

interface PriceOptimization {
  currentPricing: Array<{tier: string, currentPrice: number, suggestedPrice: number, reason: string}>;
  demandCurve: Array<{price: number, estimatedDemand: number, revenue: number}>;
  competitorPricing: Array<{competitor: string, tier: string, price: number, difference: number}>;
  elasticityAnalysis: {
    priceElasticity: number;
    optimalPricePoint: number;
    revenueImpact: number;
  };
  dynamicPricingRules: Array<{
    condition: string;
    adjustment: number;
    reasoning: string;
  }>;
}

interface RevenueOptimization {
  currentRevenue: number;
  optimizedRevenue: number;
  upliftPotential: number;
  riskAssessment: string;
  implementationSteps: Array<string>;
}

interface MarketPositioning {
  pricePosition: 'premium' | 'competitive' | 'value';
  marketShare: number;
  priceAdvantage: number;
  brandPerception: string;
}

export class PriceOptimization {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  async getEventPriceOptimization(eventId: string): Promise<PriceOptimization> {
    try {
      const [
        currentPricing,
        demandCurve,
        competitorPricing,
        elasticityAnalysis,
        dynamicPricingRules
      ] = await Promise.all([
        this.getCurrentPricingAnalysis(eventId),
        this.generateDemandCurve(eventId),
        this.getCompetitorPricing(eventId),
        this.calculateElasticityAnalysis(eventId),
        this.generateDynamicPricingRules(eventId)
      ]);

      return {
        currentPricing,
        demandCurve,
        competitorPricing,
        elasticityAnalysis,
        dynamicPricingRules
      };
    } catch (error) {
      console.error('Error getting price optimization:', error);
      throw error;
    }
  }

  async getRevenueOptimization(eventId: string): Promise<RevenueOptimization> {
    try {
      const currentRevenue = await this.calculateCurrentRevenue(eventId);
      const optimization = await this.calculateOptimalPricing(eventId);
      
      return {
        currentRevenue,
        optimizedRevenue: optimization.optimizedRevenue,
        upliftPotential: ((optimization.optimizedRevenue - currentRevenue) / currentRevenue) * 100,
        riskAssessment: optimization.riskLevel,
        implementationSteps: optimization.steps
      };
    } catch (error) {
      console.error('Error getting revenue optimization:', error);
      throw error;
    }
  }

  async getMarketPositioning(eventId: string): Promise<MarketPositioning> {
    try {
      const positioning = await this.analyzeMarketPosition(eventId);
      return positioning;
    } catch (error) {
      console.error('Error getting market positioning:', error);
      throw error;
    }
  }

  async calculateOptimalPricing(eventId: string, constraints?: any): Promise<{
    tierPricing: Array<{tier: string, currentPrice: number, optimalPrice: number, impact: number}>;
    totalRevenue: number;
    confidence: number;
  }> {
    try {
      // Get current event data
      const eventData = await this.db.query(`
        SELECT 
          e.*,
          v.capacity,
          COUNT(t.id) as tickets_sold,
          AVG(t.price) as avg_price
        FROM events e
        JOIN venues v ON e.venue_id = v.id
        LEFT JOIN tickets t ON e.id = t.event_id
        WHERE e.id = $1
        GROUP BY e.id, v.capacity
      `, [eventId]);

      if (eventData.rows.length === 0) {
        throw new Error('Event not found');
      }

      const event = eventData.rows[0];
      const soldRate = event.tickets_sold / event.capacity;

      // Get tier-specific data
      const tierData = await this.db.query(`
        SELECT 
          tier,
          COUNT(*) as sold,
          AVG(price) as avg_price,
          MAX(price) as max_price,
          MIN(price) as min_price
        FROM tickets
        WHERE event_id = $1
        GROUP BY tier
      `, [eventId]);

      const tierPricing = tierData.rows.map(tier => {
        const demandScore = this.calculateDemandScore(tier, soldRate);
        const competitorAdjustment = this.getCompetitorAdjustment(tier.tier);
        const optimalPrice = this.calculateOptimalPrice(
          tier.avg_price,
          demandScore,
          competitorAdjustment,
          constraints
        );

        return {
          tier: tier.tier,
          currentPrice: parseFloat(tier.avg_price),
          optimalPrice,
          impact: ((optimalPrice - tier.avg_price) / tier.avg_price) * 100
        };
      });

      const totalRevenue = tierPricing.reduce((sum, tier) => {
        return sum + (tier.optimalPrice * this.estimateDemandAtPrice(tier.tier, tier.optimalPrice));
      }, 0);

      return {
        tierPricing,
        totalRevenue,
        confidence: this.calculateConfidence(eventData, tierData.rows.length)
      };
    } catch (error) {
      console.error('Error calculating optimal pricing:', error);
      throw error;
    }
  }

  private async getCurrentPricingAnalysis(eventId: string): Promise<Array<{tier: string, currentPrice: number, suggestedPrice: number, reason: string}>> {
    const result = await this.db.query(`
      SELECT 
        tier,
        AVG(price) as current_price,
        COUNT(*) as sold,
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as sold_percentage
      FROM tickets
      WHERE event_id = $1
      GROUP BY tier
      ORDER BY AVG(price) DESC
    `, [eventId]);

    return result.rows.map(row => {
      const currentPrice = parseFloat(row.current_price);
      const soldPercentage = parseFloat(row.sold_percentage);
      
      let suggestedPrice = currentPrice;
      let reason = 'Maintain current pricing';

      if (soldPercentage > 80) {
        suggestedPrice = currentPrice * 1.15;
        reason = 'High demand - increase price by 15%';
      } else if (soldPercentage < 30) {
        suggestedPrice = currentPrice * 0.9;
        reason = 'Low demand - decrease price by 10%';
      } else if (soldPercentage > 60) {
        suggestedPrice = currentPrice * 1.05;
        reason = 'Good demand - slight increase of 5%';
      }

      return {
        tier: row.tier,
        currentPrice,
        suggestedPrice: Math.round(suggestedPrice * 100) / 100,
        reason
      };
    });
  }

  private async generateDemandCurve(eventId: string): Promise<Array<{price: number, estimatedDemand: number, revenue: number}>> {
    // Get historical pricing data to model demand curve
    const pricePoints = [50, 75, 100, 125, 150, 200, 250, 300];
    const demandCurve = [];

    for (const price of pricePoints) {
      const estimatedDemand = await this.estimateDemandAtPrice(eventId, price);
      demandCurve.push({
        price,
        estimatedDemand,
        revenue: price * estimatedDemand
      });
    }

    return demandCurve;
  }

  private async getCompetitorPricing(eventId: string): Promise<Array<{competitor: string, tier: string, price: number, difference: number}>> {
    // In practice, this would integrate with competitor monitoring APIs
    // For now, return mock data based on similar events
    const result = await this.db.query(`
      SELECT 
        tier,
        AVG(price) as our_price
      FROM tickets
      WHERE event_id = $1
      GROUP BY tier
    `, [eventId]);

    const competitors = [
      {name: 'Ticketmaster', multiplier: 1.28},
      {name: 'StubHub', multiplier: 1.25},
      {name: 'SeatGeek', multiplier: 1.20},
      {name: 'Vivid Seats', multiplier: 1.22}
    ];

    const competitorPricing = [];
    
    for (const tier of result.rows) {
      for (const competitor of competitors) {
        const competitorPrice = parseFloat(tier.our_price) * competitor.multiplier;
        competitorPricing.push({
          competitor: competitor.name,
          tier: tier.tier,
          price: Math.round(competitorPrice * 100) / 100,
          difference: competitorPrice - parseFloat(tier.our_price)
        });
      }
    }

    return competitorPricing;
  }

  private async calculateElasticityAnalysis(eventId: string): Promise<{priceElasticity: number, optimalPricePoint: number, revenueImpact: number}> {
    // Calculate price elasticity of demand
    const historicalData = await this.db.query(`
      SELECT 
        price,
        COUNT(*) as quantity
      FROM tickets
      WHERE event_id = $1
      GROUP BY price
      ORDER BY price
    `, [eventId]);

    if (historicalData.rows.length < 2) {
      return {
        priceElasticity: -1.2, // Default elasticity
        optimalPricePoint: 100,
        revenueImpact: 0
      };
    }

    // Simple elasticity calculation
    const priceElasticity = this.calculateElasticity(historicalData.rows);
    const optimalPricePoint = this.findOptimalPrice(historicalData.rows);
    const revenueImpact = this.calculateRevenueImpact(optimalPricePoint, historicalData.rows);

    return {
      priceElasticity,
      optimalPricePoint,
      revenueImpact
    };
  }

  private async generateDynamicPricingRules(eventId: string): Promise<Array<{condition: string, adjustment: number, reasoning: string}>> {
    const event = await this.db.query(`
      SELECT 
        start_time,
        capacity,
        (SELECT COUNT(*) FROM tickets WHERE event_id = $1) as sold
      FROM events e
      JOIN venues v ON e.venue_id = v.id
      WHERE e.id = $1
    `, [eventId]);

    const daysUntilEvent = Math.ceil((new Date(event.rows[0].start_time).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const soldRate = event.rows[0].sold / event.rows[0].capacity;

    const rules = [
      {
        condition: `${daysUntilEvent} days until event`,
        adjustment: daysUntilEvent < 7 ? 10 : daysUntilEvent < 30 ? 5 : 0,
        reasoning: daysUntilEvent < 7 ? 'Last-week urgency premium' : 'Standard pricing'
      },
      {
        condition: `${Math.round(soldRate * 100)}% sold`,
        adjustment: soldRate > 0.8 ? 15 : soldRate > 0.6 ? 10 : soldRate < 0.3 ? -10 : 0,
        reasoning: soldRate > 0.8 ? 'High demand surge' : soldRate < 0.3 ? 'Boost demand' : 'Normal demand'
      },
      {
        condition: 'Weekend effect',
        adjustment: new Date().getDay() === 0 || new Date().getDay() === 6 ? 5 : 0,
        reasoning: 'Weekend traffic increase'
      },
      {
        condition: 'Peak hours (6-9 PM)',
        adjustment: new Date().getHours() >= 18 && new Date().getHours() <= 21 ? 3 : 0,
        reasoning: 'Peak buying hours'
      }
    ];

    return rules.filter(rule => rule.adjustment !== 0);
  }

  private async calculateCurrentRevenue(eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT SUM(price) as total_revenue
      FROM tickets
      WHERE event_id = $1
    `, [eventId]);

    return parseFloat(result.rows[0]?.total_revenue || '0');
  }

  private async analyzeMarketPosition(eventId: string): Promise<MarketPositioning> {
    const avgPrice = await this.db.query(`
      SELECT AVG(price) as our_avg_price
      FROM tickets
      WHERE event_id = $1
    `, [eventId]);

    const ourPrice = parseFloat(avgPrice.rows[0]?.our_avg_price || '0');
    
    // Compare with market averages (mock data)
    const marketAvg = 120; // Would come from market research
    const pricePosition = ourPrice > marketAvg * 1.2 ? 'premium' : 
                         ourPrice < marketAvg * 0.8 ? 'value' : 'competitive';

    return {
      pricePosition,
      marketShare: 5.2, // Would calculate from actual market data
      priceAdvantage: ((marketAvg - ourPrice) / marketAvg) * 100,
      brandPerception: 'Innovation-focused platform with transparent pricing'
    };
  }

  private calculateDemandScore(tierData: any, soldRate: number): number {
    // Proprietary demand scoring algorithm
    const velocityScore = tierData.sold / 100; // Simplified
    const capacityScore = soldRate;
    const timeScore = 0.8; // Would factor in time until event
    
    return (velocityScore * 0.4 + capacityScore * 0.4 + timeScore * 0.2) * 100;
  }

  private getCompetitorAdjustment(tier: string): number {
    // Mock competitor adjustment data
    const adjustments: Record<string, number> = {
      'GA': -0.1,      // 10% below competitors
      'VIP': -0.05,    // 5% below competitors
      'Premium': 0.02   // 2% above competitors
    };

    return adjustments[tier] || 0;
  }

  private calculateOptimalPrice(currentPrice: number, demandScore: number, competitorAdj: number, constraints?: any): number {
    let adjustment = 1.0;
    
    // Demand-based adjustment
    if (demandScore > 80) adjustment *= 1.15;
    else if (demandScore > 60) adjustment *= 1.05;
    else if (demandScore < 30) adjustment *= 0.9;
    
    // Competitor adjustment
    adjustment += competitorAdj;
    
    // Apply constraints
    if (constraints?.maxIncrease) {
      adjustment = Math.min(adjustment, 1 + constraints.maxIncrease);
    }
    
    return Math.round(currentPrice * adjustment * 100) / 100;
  }

  private async estimateDemandAtPrice(tierOrEventId: string, price: number): Promise<number> {
    // Simplified demand estimation model
    // In practice, would use machine learning models
    const baseDemand = 1000;
    const elasticity = -1.2;
    const basePrice = 100;
    
    const demandMultiplier = Math.pow(price / basePrice, elasticity);
    return Math.round(baseDemand * demandMultiplier);
  }

  private calculateElasticity(priceData: any[]): number {
    if (priceData.length < 2) return -1.2;
    
    // Simple elasticity calculation using two points
    const point1 = priceData[0];
    const point2 = priceData[priceData.length - 1];
    
    const priceChange = (point2.price - point1.price) / point1.price;
    const quantityChange = (point2.quantity - point1.quantity) / point1.quantity;
    
    return quantityChange / priceChange;
  }

  private findOptimalPrice(priceData: any[]): number {
    // Find price point with maximum revenue
    let maxRevenue = 0;
    let optimalPrice = 100;
    
    for (const point of priceData) {
      const revenue = point.price * point.quantity;
      if (revenue > maxRevenue) {
        maxRevenue = revenue;
        optimalPrice = point.price;
      }
    }
    
    return optimalPrice;
  }

  private calculateRevenueImpact(optimalPrice: number, currentData: any[]): number {
    const currentRevenue = currentData.reduce((sum, point) => sum + (point.price * point.quantity), 0);
    const avgCurrentPrice = currentRevenue / currentData.reduce((sum, point) => sum + point.quantity, 0);
    const estimatedOptimalRevenue = optimalPrice * this.estimateDemandAtPrice('', optimalPrice);
    
    return ((estimatedOptimalRevenue - currentRevenue) / currentRevenue) * 100;
  }

  private calculateConfidence(eventData: any, tierCount: number): number {
    // Calculate confidence based on data quality
    const dataQualityScore = Math.min(100, (eventData.length * 10) + (tierCount * 20));
    return Math.max(60, dataQualityScore);
  }
}
