import winston from 'winston';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logLevel = process.env.LOG_LEVEL || 'debug';

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
    })
  ]
});

if (process.env.GOOGLE_CLOUD_PROJECT) {
  try {
    logger.info('Google Cloud Logging will be configured when @google-cloud/logging-winston is installed');
  } catch (error) {
    logger.warn('Google Cloud Logging not available:', error);
  }
}

type ClassOrFn = Function | InstanceType<any>;

export const createModuleLogger = (classOrFnInstance: ClassOrFn, extraPrefixes = []) =>
logger.child({
  modulePrefix: `[${typeof classOrFnInstance === 'function' ? 
    classOrFnInstance.name : 
    classOrFnInstance.constructor.name}]${extraPrefixes.map((prefix) => `[${prefix}]`).join('')} `,
})

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
