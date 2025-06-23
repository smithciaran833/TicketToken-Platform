export const mockDB = {
  query: jest.fn().mockImplementation((query: string, params?: any[]) => {
    if (query.includes('user_profiles')) {
      return Promise.resolve({
        rows: [{ current_tier: 'gold', total_points: 3000 }]
      });
    }
    return Promise.resolve({ rows: [] });
  }),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn()
  })
};

export const mockRedis = {
  get: jest.fn().mockResolvedValue('1000'),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1)
};
