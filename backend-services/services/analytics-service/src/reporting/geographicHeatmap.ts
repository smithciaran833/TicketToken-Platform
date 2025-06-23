import { Pool } from 'pg';
import Redis from 'ioredis';

interface GeographicData {
  countries: Array<{
    code: string;
    name: string;
    fans: number;
    revenue: number;
    coordinates: [number, number];
  }>;
  states: Array<{
    code: string;
    name: string;
    fans: number;
    revenue: number;
    coordinates: [number, number];
  }>;
  cities: Array<{
    name: string;
    state: string;
    country: string;
    fans: number;
    revenue: number;
    coordinates: [number, number];
  }>;
  heatmapData: Array<{
    lat: number;
    lng: number;
    weight: number;
  }>;
}

interface TravelAnalysis {
  localFans: number;
  travelingFans: number;
  averageDistance: number;
  topOriginCities: Array<{
    city: string;
    state: string;
    distance: number;
    fanCount: number;
  }>;
}

interface MarketPenetration {
  totalMarket: number;
  capturedMarket: number;
  penetrationRate: number;
  growthOpportunity: number;
  competitorPresence: number;
}

export class GeographicHeatmap {
  private db: Pool;
  private redis: Redis;
  private cityCoordinates: Map<string, [number, number]> = new Map();

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.initializeCityCoordinates();
  }

  async getEventGeographicData(eventId: string): Promise<GeographicData> {
    try {
      const [countries, states, cities] = await Promise.all([
        this.getCountryData(eventId),
        this.getStateData(eventId),
        this.getCityData(eventId)
      ]);

      const heatmapData = this.generateHeatmapData(cities);

      return {
        countries,
        states,
        cities,
        heatmapData
      };
    } catch (error) {
      console.error('Error getting geographic data:', error);
      throw error;
    }
  }

  async getArtistGeographicData(artistId: string): Promise<GeographicData> {
    try {
      const [countries, states, cities] = await Promise.all([
        this.getArtistCountryData(artistId),
        this.getArtistStateData(artistId),
        this.getArtistCityData(artistId)
      ]);

      const heatmapData = this.generateHeatmapData(cities);

      return {
        countries,
        states,
        cities,
        heatmapData
      };
    } catch (error) {
      console.error('Error getting artist geographic data:', error);
      throw error;
    }
  }

  async getTravelAnalysis(eventId: string): Promise<TravelAnalysis> {
    try {
      // Get event location
      const eventLocation = await this.db.query(`
        SELECT v.city, v.state, v.country, v.latitude, v.longitude
        FROM events e
        JOIN venues v ON e.venue_id = v.id
        WHERE e.id = $1
      `, [eventId]);

      if (eventLocation.rows.length === 0) {
        throw new Error('Event location not found');
      }

      const venue = eventLocation.rows[0];
      const venueLat = parseFloat(venue.latitude);
      const venueLng = parseFloat(venue.longitude);

      // Get fan locations and calculate distances
      const fanLocations = await this.db.query(`
        SELECT 
          u.city,
          u.state,
          u.country,
          COUNT(*) as fan_count,
          u.latitude,
          u.longitude
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        WHERE t.event_id = $1
          AND u.latitude IS NOT NULL
          AND u.longitude IS NOT NULL
        GROUP BY u.city, u.state, u.country, u.latitude, u.longitude
      `, [eventId]);

      let localFans = 0;
      let travelingFans = 0;
      let totalDistance = 0;
      const topOriginCities: Array<{city: string, state: string, distance: number, fanCount: number}> = [];

      for (const location of fanLocations.rows) {
        const fanLat = parseFloat(location.latitude);
        const fanLng = parseFloat(location.longitude);
        const distance = this.calculateDistance(venueLat, venueLng, fanLat, fanLng);
        const fanCount = parseInt(location.fan_count);

        if (distance <= 50) { // Within 50 miles = local
          localFans += fanCount;
        } else {
          travelingFans += fanCount;
          totalDistance += distance * fanCount;
        }

        topOriginCities.push({
          city: location.city,
          state: location.state,
          distance,
          fanCount
        });
      }

      // Sort by fan count and distance
      topOriginCities.sort((a, b) => {
        if (b.fanCount === a.fanCount) {
          return b.distance - a.distance; // Farther cities first if same fan count
        }
        return b.fanCount - a.fanCount;
      });

      const averageDistance = travelingFans > 0 ? totalDistance / travelingFans : 0;

      return {
        localFans,
        travelingFans,
        averageDistance,
        topOriginCities: topOriginCities.slice(0, 10)
      };
    } catch (error) {
      console.error('Error getting travel analysis:', error);
      throw error;
    }
  }

  async getMarketPenetration(city: string, state: string, genre?: string): Promise<MarketPenetration> {
    try {
      // Get market size estimates (this would typically come from external data)
      const marketSize = await this.estimateMarketSize(city, state, genre);
      
      // Get our captured market
      const capturedResult = await this.db.query(`
        SELECT COUNT(DISTINCT u.id) as captured_fans
        FROM users u
        JOIN tickets t ON u.id = t.user_id
        JOIN events e ON t.event_id = e.id
        WHERE u.city = $1 AND u.state = $2
          ${genre ? 'AND e.genre = $3' : ''}
      `, genre ? [city, state, genre] : [city, state]);

      const capturedMarket = parseInt(capturedResult.rows[0].captured_fans || '0');
      const penetrationRate = marketSize > 0 ? (capturedMarket / marketSize) * 100 : 0;
      const growthOpportunity = marketSize - capturedMarket;

      // Estimate competitor presence (simplified)
      const competitorPresence = Math.max(0, 100 - penetrationRate * 2);

      return {
        totalMarket: marketSize,
        capturedMarket,
        penetrationRate,
        growthOpportunity,
        competitorPresence
      };
    } catch (error) {
      console.error('Error getting market penetration:', error);
      return {
        totalMarket: 0,
        capturedMarket: 0,
        penetrationRate: 0,
        growthOpportunity: 0,
        competitorPresence: 0
      };
    }
  }

  async getGrowthOpportunities(artistId: string): Promise<Array<{
    city: string;
    state: string;
    country: string;
    opportunity: number;
    reasoning: string;
  }>> {
    try {
      // Get current market presence
      const currentMarkets = await this.db.query(`
        SELECT 
          u.city,
          u.state,
          u.country,
          COUNT(DISTINCT u.id) as fans,
          SUM(t.price) as revenue
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        JOIN events e ON t.event_id = e.id
        WHERE e.artist_id = $1
        GROUP BY u.city, u.state, u.country
        HAVING COUNT(DISTINCT u.id) >= 10
        ORDER BY fans DESC
      `, [artistId]);

      // Analyze patterns and suggest new markets
      const opportunities: Array<{city: string, state: string, country: string, opportunity: number, reasoning: string}> = [];

      // Get similar markets (simplified algorithm)
      const similarCities = await this.findSimilarCities(currentMarkets.rows);

      for (const city of similarCities) {
        const penetration = await this.getMarketPenetration(city.name, city.state);
        
        if (penetration.penetrationRate < 5 && penetration.totalMarket > 1000) {
          opportunities.push({
            city: city.name,
            state: city.state,
            country: city.country,
            opportunity: penetration.growthOpportunity,
            reasoning: `Similar demographics to top markets, low current penetration (${penetration.penetrationRate.toFixed(1)}%)`
          });
        }
      }

      return opportunities.slice(0, 20);
    } catch (error) {
      console.error('Error getting growth opportunities:', error);
      return [];
    }
  }

  private async getCountryData(eventId: string): Promise<Array<{code: string, name: string, fans: number, revenue: number, coordinates: [number, number]}>> {
    const result = await this.db.query(`
      SELECT 
        u.country,
        COUNT(DISTINCT u.id) as fans,
        SUM(t.price) as revenue
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = $1
        AND u.country IS NOT NULL
      GROUP BY u.country
      ORDER BY fans DESC
    `, [eventId]);

    return result.rows.map(row => ({
      code: this.getCountryCode(row.country),
      name: row.country,
      fans: parseInt(row.fans),
      revenue: parseFloat(row.revenue || '0'),
      coordinates: this.getCountryCoordinates(row.country)
    }));
  }

  private async getStateData(eventId: string): Promise<Array<{code: string, name: string, fans: number, revenue: number, coordinates: [number, number]}>> {
    const result = await this.db.query(`
      SELECT 
        u.state,
        COUNT(DISTINCT u.id) as fans,
        SUM(t.price) as revenue
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = $1
        AND u.state IS NOT NULL
        AND u.country = 'United States'
      GROUP BY u.state
      ORDER BY fans DESC
    `, [eventId]);

    return result.rows.map(row => ({
      code: row.state,
      name: row.state,
      fans: parseInt(row.fans),
      revenue: parseFloat(row.revenue || '0'),
      coordinates: this.getStateCoordinates(row.state)
    }));
  }

  private async getCityData(eventId: string): Promise<Array<{name: string, state: string, country: string, fans: number, revenue: number, coordinates: [number, number]}>> {
    const result = await this.db.query(`
      SELECT 
        u.city,
        u.state,
        u.country,
        COUNT(DISTINCT u.id) as fans,
        SUM(t.price) as revenue,
        AVG(u.latitude) as lat,
        AVG(u.longitude) as lng
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = $1
        AND u.city IS NOT NULL
        AND u.latitude IS NOT NULL
        AND u.longitude IS NOT NULL
      GROUP BY u.city, u.state, u.country
      ORDER BY fans DESC
      LIMIT 100
    `, [eventId]);

    return result.rows.map(row => ({
      name: row.city,
      state: row.state || '',
      country: row.country,
      fans: parseInt(row.fans),
      revenue: parseFloat(row.revenue || '0'),
      coordinates: [parseFloat(row.lat), parseFloat(row.lng)]
    }));
  }

  private async getArtistCountryData(artistId: string): Promise<Array<{code: string, name: string, fans: number, revenue: number, coordinates: [number, number]}>> {
    const result = await this.db.query(`
      SELECT 
        u.country,
        COUNT(DISTINCT u.id) as fans,
        SUM(t.price) as revenue
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      JOIN events e ON t.event_id = e.id
      WHERE e.artist_id = $1
        AND u.country IS NOT NULL
      GROUP BY u.country
      ORDER BY fans DESC
    `, [artistId]);

    return result.rows.map(row => ({
      code: this.getCountryCode(row.country),
      name: row.country,
      fans: parseInt(row.fans),
      revenue: parseFloat(row.revenue || '0'),
      coordinates: this.getCountryCoordinates(row.country)
    }));
  }

  private async getArtistStateData(artistId: string): Promise<Array<{code: string, name: string, fans: number, revenue: number, coordinates: [number, number]}>> {
    const result = await this.db.query(`
      SELECT 
        u.state,
        COUNT(DISTINCT u.id) as fans,
        SUM(t.price) as revenue
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      JOIN events e ON t.event_id = e.id
      WHERE e.artist_id = $1
        AND u.state IS NOT NULL
        AND u.country = 'United States'
      GROUP BY u.state
      ORDER BY fans DESC
    `, [artistId]);

    return result.rows.map(row => ({
      code: row.state,
      name: row.state,
      fans: parseInt(row.fans),
      revenue: parseFloat(row.revenue || '0'),
      coordinates: this.getStateCoordinates(row.state)
    }));
  }

  private async getArtistCityData(artistId: string): Promise<Array<{name: string, state: string, country: string, fans: number, revenue: number, coordinates: [number, number]}>> {
    const result = await this.db.query(`
      SELECT 
        u.city,
        u.state,
        u.country,
        COUNT(DISTINCT u.id) as fans,
        SUM(t.price) as revenue,
        AVG(u.latitude) as lat,
        AVG(u.longitude) as lng
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      JOIN events e ON t.event_id = e.id
      WHERE e.artist_id = $1
        AND u.city IS NOT NULL
        AND u.latitude IS NOT NULL
        AND u.longitude IS NOT NULL
      GROUP BY u.city, u.state, u.country
      ORDER BY fans DESC
      LIMIT 100
    `, [artistId]);

    return result.rows.map(row => ({
      name: row.city,
      state: row.state || '',
      country: row.country,
      fans: parseInt(row.fans),
      revenue: parseFloat(row.revenue || '0'),
      coordinates: [parseFloat(row.lat), parseFloat(row.lng)]
    }));
  }

  private generateHeatmapData(cities: Array<{name: string, fans: number, coordinates: [number, number]}>): Array<{lat: number, lng: number, weight: number}> {
    return cities.map(city => ({
      lat: city.coordinates[0],
      lng: city.coordinates[1],
      weight: Math.log(city.fans + 1) // Log scale for better visualization
    }));
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async estimateMarketSize(city: string, state: string, genre?: string): Promise<number> {
    // This would typically use external demographic data
    // For now, return a simplified estimate based on city size
    const cityPopulations: Record<string, number> = {
      'New York': 8400000,
      'Los Angeles': 4000000,
      'Chicago': 2700000,
      'Houston': 2300000,
      'Phoenix': 1600000,
      'Philadelphia': 1600000,
      'San Antonio': 1500000,
      'San Diego': 1400000,
      'Dallas': 1300000,
      'Miami': 470000
    };

    const population = cityPopulations[city] || 100000; // Default estimate
    
    // Estimate percentage interested in live music (varies by genre)
    let musicInterestRate = 0.15; // 15% default
    
    if (genre) {
      const genreRates: Record<string, number> = {
        'Electronic': 0.08,
        'Hip-Hop': 0.12,
        'Rock': 0.18,
        'Pop': 0.20,
        'Country': 0.14
      };
      musicInterestRate = genreRates[genre] || musicInterestRate;
    }

    return Math.round(population * musicInterestRate);
  }

  private async findSimilarCities(currentMarkets: any[]): Promise<Array<{name: string, state: string, country: string}>> {
    // Simplified algorithm - in reality would use demographic clustering
    const similarCities = [
      { name: 'Austin', state: 'TX', country: 'United States' },
      { name: 'Nashville', state: 'TN', country: 'United States' },
      { name: 'Denver', state: 'CO', country: 'United States' },
      { name: 'Seattle', state: 'WA', country: 'United States' },
      { name: 'Portland', state: 'OR', country: 'United States' },
      { name: 'Atlanta', state: 'GA', country: 'United States' },
      { name: 'San Francisco', state: 'CA', country: 'United States' },
      { name: 'Boston', state: 'MA', country: 'United States' }
    ];

    return similarCities;
  }

  private getCountryCode(countryName: string): string {
    const countryCodes: Record<string, string> = {
      'United States': 'US',
      'Canada': 'CA',
      'United Kingdom': 'GB',
      'Germany': 'DE',
      'France': 'FR',
      'Australia': 'AU',
      'Japan': 'JP',
      'Brazil': 'BR',
      'Mexico': 'MX',
      'Netherlands': 'NL'
    };

    return countryCodes[countryName] || 'US';
  }

  private getCountryCoordinates(countryName: string): [number, number] {
    const countryCoords: Record<string, [number, number]> = {
      'United States': [39.8283, -98.5795],
      'Canada': [56.1304, -106.3468],
      'United Kingdom': [55.3781, -3.4360],
      'Germany': [51.1657, 10.4515],
      'France': [46.2276, 2.2137],
      'Australia': [-25.2744, 133.7751],
      'Japan': [36.2048, 138.2529],
      'Brazil': [-14.2350, -51.9253],
      'Mexico': [23.6345, -102.5528],
      'Netherlands': [52.1326, 5.2913]
    };

    return countryCoords[countryName] || [0, 0];
  }

  private getStateCoordinates(stateName: string): [number, number] {
    const stateCoords: Record<string, [number, number]> = {
      'FL': [27.7663, -81.6868],
      'CA': [36.1162, -119.6816],
      'TX': [31.0545, -97.5635],
      'NY': [42.1657, -74.9481],
      'PA': [40.5908, -77.2098],
      'IL': [40.3363, -89.0022],
      'OH': [40.3888, -82.7649],
      'GA': [33.0406, -83.6431],
      'NC': [35.6301, -79.8064],
      'MI': [43.3266, -84.5361]
    };

    return stateCoords[stateName] || [0, 0];
  }

  private initializeCityCoordinates(): void {
    // Initialize major city coordinates
    this.cityCoordinates.set('Miami,FL', [25.7617, -80.1918]);
    this.cityCoordinates.set('Los Angeles,CA', [34.0522, -118.2437]);
    this.cityCoordinates.set('New York,NY', [40.7128, -74.0060]);
    this.cityCoordinates.set('Chicago,IL', [41.8781, -87.6298]);
    this.cityCoordinates.set('Houston,TX', [29.7604, -95.3698]);
    // Add more as needed
  }
}
