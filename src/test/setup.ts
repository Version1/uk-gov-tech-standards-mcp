import { beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';
import path from 'path';
import { promises as fs } from 'fs';

// Load test environment variables
config({ path: '.env.test' });

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'sqlite:./test-standards.db';
  process.env.LOG_LEVEL = 'silent';
  process.env.PUPPETEER_HEADLESS = 'true';
  
  // Create test logs directory
  await fs.mkdir('./test-logs', { recursive: true }).catch(() => {});
});

afterAll(async () => {
  // Clean up test databases and logs
  const testFiles = ['./test-standards.db', './test-logs'];
  
  for (const file of testFiles) {
    try {
      await fs.rm(file, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});