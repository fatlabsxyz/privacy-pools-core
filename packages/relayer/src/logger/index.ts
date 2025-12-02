import winston from 'winston';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(logColors);

// Simple JSON format for all environments
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Get log level from environment variable, default to debug
const logLevel = process.env.LOG_LEVEL || 'debug';

// Create and configure the winston logger
const logger = winston.createLogger({
  level: logLevel,
  levels: logLevels,
  format: logFormat,
  defaultMeta: {
    service: 'privacy-pools-relayer',
    version: process.env.npm_package_version || 'unknown',
  },
  transports: [
    new winston.transports.Console({
      level: logLevel,
      format: logFormat,
    })
  ]
});

// Add Google Cloud Logging support when GOOGLE_CLOUD_PROJECT is set
if (process.env.GOOGLE_CLOUD_PROJECT) {
  try {
    // Note: This will be added later when we install @google-cloud/logging-winston
    logger.info('Google Cloud Logging will be configured when @google-cloud/logging-winston is installed');
  } catch (error) {
    logger.warn('Google Cloud Logging not available:', error);
  }
}

// Export logger and utility functions
export { logger };

// Utility functions for common logging patterns
export const logRequest = (method: string, path: string, statusCode?: number, duration?: number) => {
  const meta = { method, path, statusCode, duration };
  if (statusCode && statusCode >= 400) {
    logger.error('Request failed', meta);
  } else {
    logger.http('Request completed', meta);
  }
};

export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

export const logConfig = (action: string, details: Record<string, unknown>) => {
  logger.info('Configuration action', { action, ...details });
};

export const logChainOperation = (chainId: number, operation: string, details?: Record<string, unknown>) => {
  logger.info('Chain operation', { chainId, operation, ...details });
};

export default logger;