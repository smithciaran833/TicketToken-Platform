import { ContentGating } from '../../src/gating/contentGating';
import { PresaleGating } from '../../src/gating/presaleGating';
import { TierVerification } from '../../src/gating/tierVerification';
import { mockDB, mockRedis } from '../mocks/mockServices';

describe('Access Control Integration', () => {
  let contentGating: ContentGating;
  let presaleGating: PresaleGating;
  let tierVerification: TierVerification;

  beforeEach(() => {
    jest.clearAllMocks();
    contentGating = new ContentGating(mockDB as any, mockRedis as any);
    presaleGating = new PresaleGating(mockDB as any, mockRedis as any);
    tierVerification = new TierVerification(mockDB as any, mockRedis as any);
  });

  describe('Complete User Access Journey', () => {
    test('should handle bronze to gold tier upgrade journey', async () => {
      const userId = 'integration-user-123';

      // Step 1: User starts as bronze tier
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'bronze', total_points: 500 }]
      });

      let tierInfo = await tierVerification.verifyUserTier(userId);
      expect(tierInfo.tier).toBe('bronze');
      expect(tierInfo.level).toBe(1);

      // Step 2: Check access to premium content (should be denied)
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'bronze' }]
      });

      let contentAccess = await contentGating.checkContentAccess(userId, 'premium-content', ['premium']);
      expect(contentAccess.hasAccess).toBe(false);

      // Step 3: Check presale access (should be denied)
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'bronze' }]
      });

      let presaleAccess = await presaleGating.checkPresaleAccess(userId, 'exclusive-event');
      expect(presaleAccess.hasAccess).toBe(false);

      // Step 4: User upgrades to gold tier
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'gold', total_points: 3000 }]
      });

      tierInfo = await tierVerification.verifyUserTier(userId);
      expect(tierInfo.tier).toBe('gold');
      expect(tierInfo.level).toBe(3);

      // Step 5: Check access again (should now be granted)
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'gold' }]
      });

      contentAccess = await contentGating.checkContentAccess(userId, 'premium-content', ['premium']);
      expect(contentAccess.hasAccess).toBe(true);

      // Step 6: Check presale access (should now be granted)
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'gold' }]
      });

      presaleAccess = await presaleGating.checkPresaleAccess(userId, 'exclusive-event');
      expect(presaleAccess.hasAccess).toBe(true);
      expect(presaleAccess.accessType).toBe('tier');
    });

    test('should handle VIP pass access flow', async () => {
      const userId = 'vip-user-456';

      // Mock user with VIP pass
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'silver', total_points: 1500 }]
      });

      const tierInfo = await tierVerification.verifyUserTier(userId);
      expect(tierInfo.tier).toBe('silver');

      // Even silver tier should get some benefits
      expect(tierInfo.benefits).toContain('Presale access');
    });

    test('should handle content unlock flow', async () => {
      const userId = 'content-user-789';
      const contentId = 'exclusive-video-123';

      // Step 1: Check initial access (denied)
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'bronze' }]
      });

      let access = await contentGating.checkContentAccess(userId, contentId, ['premium']);
      expect(access.hasAccess).toBe(false);

      // Step 2: Unlock with points
      const unlockResult = await contentGating.unlockContent(userId, contentId, 'points');
      expect(unlockResult.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock database error
      mockDB.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        tierVerification.verifyUserTier('error-user')
      ).rejects.toThrow('Database connection failed');
    });

    test('should handle invalid user IDs', async () => {
      // Mock empty result
      mockDB.query.mockResolvedValueOnce({ rows: [] });

      const result = await tierVerification.verifyUserTier('nonexistent-user');
      expect(result.tier).toBe('bronze'); // Default tier
    });
  });
});
