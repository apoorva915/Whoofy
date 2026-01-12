import pino from 'pino';

/**
 * Logger Configuration
 * Simplified to avoid worker thread issues in Next.js API routes
 */
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  // Disable pino-pretty in API routes to avoid worker thread issues
  transport: undefined,
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});export default logger;
