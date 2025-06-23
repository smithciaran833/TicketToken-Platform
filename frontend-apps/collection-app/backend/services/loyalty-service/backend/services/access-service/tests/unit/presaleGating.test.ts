import { PresaleGating } from '../../src/gating/presaleGating';
import { mockDB, mockRedis } from '../mocks/mockServices';

describe('PresaleGating', () => {
  let presaleGating: PresaleGating;

  beforeEach(() => {
    jest.clearAllMocks();
    presaleGating = new PresaleGating(mockDB as any, mockRedis as any);
  });

  describe('Presale Access Control', () => {
    test('should grant presale access to gold+ tier users', async () => {
      // Mock gold tier user
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'gold' }]
      });

      const result = await presaleGating.checkPresaleAccess('user-123', 'event-789');

      expect(result.hasAccess).toBe(true);
      expect(result.accessType).toBe('tier');
    });

    test('should deny presale access to bronze/silver tier users', async () => {
      // Mock bronze tier user
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'bronze' }]
      });

      const result = await presaleGating.checkPresaleAccess('user-123', 'event-789');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toContain('Insufficient tier level');
    });

    test('should allow platinum users to enter presale', async () => {
      // Mock platinum tier user
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'platinum' }]
      });

      // Mock presale access check
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'platinum' }]
      });

      const result = await presaleGating.enterPresale('user-123', 'event-789');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully entered presale');
    });

    test('should deny presale entry for insufficient tier', async () => {
      // Mock silver tier user
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'silver' }]
      });

      // Mock presale access check
      mockDB.query.mockResolvedValueOnce({
        rows: [{ current_tier: 'silver' }]
      });

      const result = await presaleGating.enterPresale('user-123', 'event-789');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Access denied');
    });
  });
});
