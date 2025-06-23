import { TierVerification } from '../../src/gating/tierVerification';
import { mockDB, mockRedis } from '../mocks/mockServices';

describe('TierVerification', () => {
  let tierVerification: TierVerification;

  beforeEach(() => {
    jest.clearAllMocks();
    tierVerification = new TierVerification(mockDB as any, mockRedis as any);
  });

  describe('Tier Verification', () => {
    test('should verify user tier correctly', async () => {
      // Mock gold tier user
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'gold', total_points: 3000 }]
      });

      const result = await tierVerification.verifyUserTier('user-123');

      expect(result.tier).toBe('gold');
      expect(result.level).toBe(3);
      expect(result.benefits).toContain('Premium content');
    });

    test('should return default tier for new users', async () => {
      // Mock no user found
      mockDB.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await tierVerification.verifyUserTier('new-user');

      expect(result.tier).toBe('bronze');
      expect(result.level).toBe(1);
      expect(result.benefits).toContain('Basic support');
    });

    test('should get tier benefits correctly', async () => {
      // Mock diamond tier user
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'diamond', total_points: 15000 }]
      });

      const benefits = await tierVerification.getTierBenefits('user-123');

      expect(benefits).toContain('Basic support');
      expect(benefits).toContain('Presale access');
      expect(benefits).toContain('Premium content');
      expect(benefits).toContain('VIP experiences');
      expect(benefits).toContain('Concierge service');
    });

    test('should handle different tier levels', async () => {
      const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
      
      for (let i = 0; i < tiers.length; i++) {
        mockDB.query.mockResolvedValueOnce({
          rows: [{ current_tier: tiers[i], total_points: i * 1000 }]
        });

        const result = await tierVerification.verifyUserTier(`user-${i}`);
        expect(result.tier).toBe(tiers[i]);
        expect(result.level).toBe(i + 1);
      }
    });
  });
});
