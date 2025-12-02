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

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define console format (for development)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Create transports array
const transports: winston.transport[] = [];

// Console transport (always present, but with different formats)
transports.push(
  new winston.transports.Console({
    level: isDevelopment ? 'debug' : 'info',
    format: isDevelopment ? consoleFormat : logFormat,
  })
);

// File transports for production
if (isProduction) {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    })
  );
}

// Create and configure the winston logger
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  levels: logLevels,
  format: logFormat,
  defaultMeta: {
    service: 'privacy-pools-relayer',
    version: process.env.npm_package_version || 'unknown',
  },
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({ format: consoleFormat }),
    ...(isProduction ? [new winston.transports.File({ filename: 'logs/exceptions.log' })] : []),
  ],
  rejectionHandlers: [
    new winston.transports.Console({ format: consoleFormat }),
    ...(isProduction ? [new winston.transports.File({ filename: 'logs/rejections.log' })] : []),
  ],
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