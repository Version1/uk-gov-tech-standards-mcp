import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);

export class UpdateScheduler {
  private updateInterval: string;
  private task: cron.ScheduledTask | null = null;

  constructor() {
    // Parse update interval from environment
    this.updateInterval = this.parseUpdateInterval();
  }

  private parseUpdateInterval(): string {
    const interval = process.env.UPDATE_INTERVAL || 'daily';
    
    switch (interval.toLowerCase()) {
      case 'hourly':
        return '0 * * * *'; // Every hour
      case 'daily':
        return '0 2 * * *'; // Daily at 2 AM
      case 'weekly':
        return '0 2 * * 0'; // Weekly on Sunday at 2 AM
      case 'monthly':
        return '0 2 1 * *'; // Monthly on 1st at 2 AM
      default:
        // Assume it's a cron expression
        return interval;
    }
  }

  start(): void {
    if (this.task) {
      logger.warn('Update scheduler is already running');
      return;
    }

    logger.info(`Starting update scheduler with interval: ${this.updateInterval}`);

    this.task = cron.schedule(this.updateInterval, async () => {
      logger.info('Starting scheduled update...');
      try {
        await this.runUpdate();
        logger.info('Scheduled update completed successfully');
      } catch (error) {
        logger.error('Scheduled update failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.task.start();
    logger.info('Update scheduler started successfully');
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Update scheduler stopped');
    }
  }

  async runUpdateNow(): Promise<void> {
    logger.info('Running manual update...');
    await this.runUpdate();
    logger.info('Manual update completed');
  }

  private async runUpdate(): Promise<void> {
    try {
      const updateCommand = 'node dist/scripts/update.js';
      const { stdout, stderr } = await execAsync(updateCommand);
      
      if (stdout) {
        logger.info('Update output:', stdout);
      }
      
      if (stderr) {
        logger.error('Update errors:', stderr);
      }
      
    } catch (error) {
      logger.error('Failed to run update command:', error);
      throw error;
    }
  }

  isRunning(): boolean {
    return this.task !== null;
  }

  getNextRun(): Date | null {
    if (!this.task) return null;
    
    try {
      // Get next execution time (this is a simplified implementation)
      // In a real implementation, you'd use a proper cron parser
      const now = new Date();
      const nextRun = new Date(now);
      
      switch (this.updateInterval) {
        case '0 * * * *': // Hourly
          nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
          break;
        case '0 2 * * *': // Daily at 2 AM
          nextRun.setDate(nextRun.getDate() + 1);
          nextRun.setHours(2, 0, 0, 0);
          break;
        case '0 2 * * 0': // Weekly on Sunday
          const daysUntilSunday = (7 - nextRun.getDay()) % 7 || 7;
          nextRun.setDate(nextRun.getDate() + daysUntilSunday);
          nextRun.setHours(2, 0, 0, 0);
          break;
        case '0 2 1 * *': // Monthly on 1st
          nextRun.setMonth(nextRun.getMonth() + 1, 1);
          nextRun.setHours(2, 0, 0, 0);
          break;
        default:
          return null;
      }
      
      return nextRun;
    } catch {
      return null;
    }
  }
}