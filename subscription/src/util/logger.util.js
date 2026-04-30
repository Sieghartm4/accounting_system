const winston = require('winston')
require('winston-daily-rotate-file')
const path = require('path')

const logDirectory = path.join(process.cwd(), 'logs')

const customLevels = {
  levels: { fatal: 0, error: 1, warn: 2, http: 3, info: 4, debug: 5, trace: 6 },
  colors: {
    fatal: 'red',
    error: 'red',
    warn: 'yellow',
    http: 'magenta',
    info: 'green',
    debug: 'blue',
    trace: 'cyan',
  },
}

const { combine, timestamp, json, printf, colorize } = winston.format

const consoleFormat = combine(
  colorize({ all: true, colors: customLevels.colors }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf((info) => {
    if (info.level.includes('http') && info.method) {
      return `[${info.timestamp}] ${info.level}: ${info.method} ${info.url} ${info.status} ${info.response_time}ms`
    }
    return `[${info.timestamp}] ${info.level}: ${info.message}`
  }),
)

const fileFormat = combine(timestamp(), json())

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({ format: consoleFormat }),

    new winston.transports.DailyRotateFile({
      dirname: logDirectory,
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
    }),

    new winston.transports.DailyRotateFile({
      dirname: logDirectory,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
    }),
  ],
})

logger.info('Logger initialized')

const morganStream = {
  write: (message) => {
    try {
      const httpData = JSON.parse(message)
      logger.http('Incoming Request', httpData)
    } catch (e) {
      logger.http(message.trim())
    }
  },
}

module.exports = {
  logger,
  morganStream,
}
