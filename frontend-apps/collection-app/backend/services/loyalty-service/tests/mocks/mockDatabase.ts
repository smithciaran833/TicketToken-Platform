import { Pool, PoolClient } from 'pg';

// Mock database responses that match your service expectations
export const mockQueryResults = {
  pointsBalance: { rows: [{ balance: 1000 }] },
  userProfile: { rows: [{ id: 'user-123', tier: 'silver', total_points: 1000 }] },
  transaction: { rows: [{ id: 'tx-123', created_at: new Date() }] },
  transferSend: { rows: [{ id: 'transfer-send-123', created_at: new Date() }] },
  transferReceive: { rows: [{ id: 'transfer-receive-123', created_at: new Date() }] },
  rewards: { rows: [
    { id: 'reward-1', name: 'VIP Upgrade', points_cost: 500, category: 'upgrades' },
    { id: 'reward-2', name: '10% Discount', points_cost: 200, category: 'discounts' }
  ]},
  tierInfo: { rows: [{
    user_id: 'user-123',
    current_tier: 'gold',
    points_earned: 3000,
    tier_since: new Date(),
    next_tier: 'platinum',
    points_to_next: 2000
  }]},
  empty: { rows: [] }
};

export const createMockDB = () => {
  let queryCallCount = 0;
  
  return {
    query: jest.fn().mockImplementation((query: string, params?: any[]) => {
      queryCallCount++;
      
      // Handle different query types based on the SQL or parameters
      if (query.includes('INSERT INTO points_transactions') && query.includes('spent')) {
        return Promise.resolve(mockQueryResults.transaction);
      }
      if (query.includes('INSERT INTO points_transactions') && query.includes('earned')) {
        return Promise.resolve(mockQueryResults.transaction);
      }
      if (query.includes('SELECT') && query.includes('balance')) {
        return Promise.resolve(mockQueryResults.pointsBalance);
      }
      if (query.includes('tier')) {
        return Promise.resolve(mockQueryResults.tierInfo);
      }
      
      // For transfers, alternate between send and receive responses
      if (query.includes('INSERT INTO points_transactions')) {
        if (queryCallCount % 2 === 1) {
          return Promise.resolve(mockQueryResults.transferSend);
        } else {
          return Promise.resolve(mockQueryResults.transferReceive);
        }
      }
      
      // Default response
      return Promise.resolve(mockQueryResults.transaction);
    }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue(mockQueryResults.transaction),
      release: jest.fn()
    } as Partial<PoolClient>)
  } as Partial<Pool>;
};

export const createMockRedis = () => ({
  get: jest.fn().mockImplementation((key: string) => {
    // Return different balances based on the key
    if (key.includes('user-123')) return Promise.resolve('500');
    if (key.includes('user-456')) return Promise.resolve('200');
    if (key.includes('sender-123')) return Promise.resolve('300');
    return Promise.resolve('1000');
  }),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  decr: jest.fn().mockResolvedValue(1),
  hget: jest.fn().mockResolvedValue('value'),
  hset: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1)
});
