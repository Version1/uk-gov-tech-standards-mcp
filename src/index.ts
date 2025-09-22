#!/usr/bin/env node

import { config } from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';
import { DatabaseManager } from './database/manager.js';
import { UKGovStandardsMCPServer } from './mcp/server.js';
import logger from './utils/logger.js';

// Load environment variables
config();

async function main(): Promise<void> {
  // Ensure we're working in the correct directory
  const projectRoot = import.meta.url.includes('file://') 
    ? path.dirname(path.dirname(new URL(import.meta.url).pathname))
    : path.dirname(__dirname);
  
  console.error(`DEBUG: Project root: ${projectRoot}`);
  console.error(`DEBUG: Current working directory: ${process.cwd()}`);
  
  const rawDbPath = process.env.DATABASE_URL?.replace('sqlite:', '') || 'standards.db';
  const dbPath = path.isAbsolute(rawDbPath) ? rawDbPath : path.join(projectRoot, rawDbPath);
  console.error(`DEBUG: Database path: ${dbPath}`);
  
  // Check if database exists
  if (!existsSync(dbPath)) {
    console.error(`ERROR: Database file not found at ${dbPath}`);
    console.error(`ERROR: Available files in project root:`);
    try {
      const { readdirSync } = await import('fs');
      const files = readdirSync(projectRoot);
      console.error(`ERROR: Files: ${files.join(', ')}`);
    } catch (e) {
      console.error(`ERROR: Could not list directory contents:`, e);
    }
  } else {
    console.error(`DEBUG: Database file found successfully`);
  }
  
  try {
    // Initialize database
    console.error('DEBUG: About to initialize database...');
    logger.info('Initializing database...');
    const db = new DatabaseManager(dbPath, projectRoot);
    console.error('DEBUG: DatabaseManager created, calling initialize...');
    await db.initialize();
    console.error('DEBUG: Database initialization completed successfully');

    // Create and start MCP server
    logger.info('Starting MCP server...');
    const server = new UKGovStandardsMCPServer(db);
    
    // Handle graceful shutdown
    const cleanup = async (): Promise<void> => {
      logger.info('Shutting down server...');
      try {
        await server.stop();
      } catch (error) {
        logger.error('Error during cleanup:', error);
      }
      process.exit(0);
    };

    // Handle unhandled errors
    process.on('uncaughtException', (error) => {
      console.error('ERROR: Uncaught exception:', error);
      logger.error('Uncaught exception:', error);
      cleanup();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('ERROR: Unhandled rejection at:', promise, 'reason:', reason);
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      cleanup();
    });

    process.on('exit', (code) => {
      console.error(`DEBUG: Process exiting with code: ${code}`);
    });

    process.on('SIGINT', () => {
      console.error('DEBUG: Received SIGINT');
      cleanup();
    });

    process.on('SIGTERM', () => {
      console.error('DEBUG: Received SIGTERM');
      cleanup();
    });

    
    // Start the server
    console.error('DEBUG: Starting MCP server...');
    await server.start();
    console.error('DEBUG: MCP server started, waiting for connections...');
    logger.info('Server is running and waiting for connections...');
    
    // Keep the process alive
    console.error('DEBUG: Resuming stdin to keep process alive...');
    process.stdin.resume();
    console.error('DEBUG: Process should now be waiting for MCP messages...');
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}