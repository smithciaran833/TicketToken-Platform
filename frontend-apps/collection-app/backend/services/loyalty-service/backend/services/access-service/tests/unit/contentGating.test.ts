import { ContentGating } from '../../src/gating/contentGating';
import { mockDB, mockRedis } from '../mocks/mockServices';

describe('ContentGating', () => {
  let contentGating: ContentGating;

  beforeEach(() => {
    jest.clearAllMocks();
    contentGating = new ContentGating(mockDB as any, mockRedis as any);
  });

  describe('Content Access Control', () => {
    test('should grant access to premium content for gold+ tier users', async () => {
      // Mock gold tier user
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'gold' }]
      });

      const result = await contentGating.checkContentAccess('user-123', 'content-456', ['premium']);

      expect(result.hasAccess).toBe(true);
      expect(result.accessLevel).toBe('premium');
    });

    test('should deny access to premium content for bronze tier users', async () => {
      // Mock bronze tier user
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'bronze' }]
      });

      const result = await contentGating.checkContentAccess('user-123', 'content-456', ['premium']);

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toContain('Insufficient access level');
    });

    test('should allow diamond tier users to access all content', async () => {
      // Mock diamond tier user
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'diamond' }]
      });

      const result = await contentGating.checkContentAccess('user-123', 'exclusive-content', ['premium']);

      expect(result.hasAccess).toBe(true);
      expect(result.accessLevel).toBe('premium');
    });

    test('should handle content unlock with points', async () => {
      const result = await contentGating.unlockContent('user-123', 'content-456', 'points');

      expect(result.success).toBe(true);
      expect(result.message).toContain('unlocked with points');
    });

    test('should reject invalid unlock methods', async () => {
      const result = await contentGating.unlockContent('user-123', 'content-456', 'invalid');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid unlock method');
    });
  });
});
