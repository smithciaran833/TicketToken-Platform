// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/loyalty_test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Global test timeout
jest.setTimeout(30000);

// Mock console for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: originalConsole.warn,
  error: originalConsole.error,
};
