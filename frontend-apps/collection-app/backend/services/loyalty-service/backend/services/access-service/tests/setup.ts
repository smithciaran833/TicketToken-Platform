// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/access_test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Global test timeout
jest.setTimeout(30000);

// Mock external services
jest.mock('@solana/web3.js');
jest.mock('@coral-xyz/anchor');

// Mock console for cleaner output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};
