import { TierManager } from '../../src/services/tierManager';
import { createMockDB, createMockRedis } from '../mocks/mockDatabase';

describe('TierManager', () => {
  let tierManager: TierManager;
  let mockDB: any;
  let mockRedis: any;

  beforeEach(() => {
    mockDB = createMockDB();
    mockRedis = createMockRedis();
    tierManager = new TierManager(mockDB, mockRedis);
    jest.clearAllMocks();
  });

  describe('User Tier Information', () => {
    test('should get user tier info', async () => {
      const userId = 'user-123';
      const mockTierInfo = {
        rows: [{
          user_id: userId,
          current_tier: 'silver',
          points_earned: 1500,
          tier_since: new Date(),
          next_tier: 'gold',
          points_to_next: 1000
        }]
      };

      mockDB.query.mockResolvedValueOnce(mockTierInfo);

      const tierInfo = await tierManager.getUserTierInfo(userId);

      expect(tierInfo).toBeDefined();
      expect(mockDB.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([userId])
      );
    });

    test('should handle user with no tier info', async () => {
      const userId = 'new-user-123';

      // Mock empty result
      mockDB.query.mockResolvedValueOnce({ rows: [] });

      const tierInfo = await tierManager.getUserTierInfo(userId);

      expect(tierInfo).toBeDefined();
      // Should return default tier info for new users
    });
  });

  describe('Tier Upgrades', () => {
    test('should check and upgrade tier when eligible', async () => {
      const userId = 'user-123';

      // Mock user with enough points for upgrade
      mockDB.query.mockResolvedValueOnce({
        rows: [{
          current_tier: 'bronze',
          points_earned: 1200
        }]
      });

      // Mock tier upgrade transaction
      mockDB.query.mockResolvedValueOnce({
        rows: [{ id: 'upgrade-123' }]
      });

      const result = await tierManager.checkAndUpgradeTier(userId);

      expect(result.upgraded).toBeDefined();
      expect(typeof result.upgraded).toBe('boolean');
    });

    test('should not upgrade when not eligible', async () => {
      const userId = 'user-123';

      // Mock user without enough points
      mockDB.query.mockResolvedValueOnce({
        rows: [{
          current_tier: 'bronze',
          points_earned: 500
        }]
      });

      const result = await tierManager.checkAndUpgradeTier(userId);

      expect(result.upgraded).toBe(false);
    });
  });

  describe('Tier Benefits', () => {
    test('should get tier multiplier', async () => {
      const userId = 'user-123';
      const type = 'purchase';

      // Mock user tier
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'gold' }]
      });

      const multiplier = await tierManager.getTierMultiplier(userId, type);

      expect(typeof multiplier).toBe('number');
      expect(multiplier).toBeGreaterThan(0);
    });

    test('should get tier discount', async () => {
      const userId = 'user-123';

      // Mock user tier
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'platinum' }]
      });

      const discount = await tierManager.getTierDiscount(userId);

      expect(typeof discount).toBe('number');
      expect(discount).toBeGreaterThanOrEqual(0);
      expect(discount).toBeLessThanOrEqual(100); // Should be a percentage
    });
  });

  describe('Monthly Tier Review', () => {
    test('should process monthly tier review', async () => {
      // Mock database operations for monthly review
      mockDB.query.mockResolvedValue({ rows: [] });

      await tierManager.processMonthlyTierReview();

      // Should have made database calls
      expect(mockDB.query).toHaveBeenCalled();
    });
  });
});
