import winston from 'winston';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const isProduction = process.env.NODE_ENV === 'production';

const logDir = path.join(process.cwd(), 'logs');

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    info.requestId = info.requestId || uuidv4();
    return info;
  })(),
  isProduction
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, requestId, stack, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          const stackStr = stack ? `\n${stack}` : '';
          return `${timestamp} [${requestId}] ${level}: ${message}${metaStr}${stackStr}`;
        })
      )
);

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: customFormat,
  defaultMeta: { service: 'menumoja-backend' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
});

if (!isProduction) {
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
      format: winston.format.json(),
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 10,
      format: winston.format.json(),
    })
  );
}

export function createRequestLogger(requestId?: string): winston.Logger {
  return logger.child({ requestId: requestId || uuidv4() });
}

export default logger;
