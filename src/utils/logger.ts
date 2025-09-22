import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

const logLevel = process.env.LOG_LEVEL || 'info';
const defaultLogFile = path.join(projectRoot, 'logs', 'server.log');
const logFile = process.env.LOG_FILE || defaultLogFile;

// Ensure logs directory exists
const logDir = path.dirname(logFile);
if (!existsSync(logDir)) {
  try {
    mkdirSync(logDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create logs directory:', error);
    // Fall back to console-only logging
  }
}

const transports: winston.transport[] = [];

// Only add console transport if not running as MCP server
// MCP servers should not output to stdout as it interferes with the protocol
const isMCPMode = process.argv.includes('--mcp') || process.env.MCP_MODE === 'true' || 
                  !process.stdin.isTTY || process.env.NODE_ENV === 'production';

if (!isMCPMode) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}

// Only add file transport if we can write to the log directory
if (existsSync(logDir)) {
  try {
    transports.push(
      new winston.transports.File({ 
        filename: logFile,
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    );
  } catch (error) {
    console.error('Failed to create file transport, using console only:', error);
  }
}

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'uk-gov-tech-standards-mcp' },
  transports
});

export default logger;