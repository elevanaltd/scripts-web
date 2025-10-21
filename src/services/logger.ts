export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogMetadata {
  [key: string]: unknown
}

interface SerializableError {
  message: string
  stack?: string
  name?: string
}

export class Logger {
  private static readonly SENSITIVE_FIELDS = new Set([
    'password',
    'token',
    'authorization',
    'secret',
    'key',
    'credentials'
  ])

  private static get isProduction(): boolean {
    return import.meta.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production'
  }

  private static get currentLogLevel(): LogLevel {
    return Logger.isProduction ? LogLevel.WARN : LogLevel.DEBUG
  }

  private static formatTimestamp(): string {
    return new Date().toISOString()
  }

  private static formatLogPrefix(level: string): string {
    return `[${level}] ${Logger.formatTimestamp()}`
  }

  private static sanitizeData(data: LogMetadata): LogMetadata {
    if (!Logger.isProduction) {
      return data
    }

    const sanitized: LogMetadata = {}

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      const isSensitive = Logger.SENSITIVE_FIELDS.has(lowerKey) ||
                         lowerKey.includes('password') ||
                         lowerKey.includes('token')

      if (isSensitive && typeof value === 'string') {
        sanitized[key] = '[REDACTED]'
      } else if (value instanceof Error) {
        sanitized[key] = Logger.serializeError(value)
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = Logger.sanitizeData(value as LogMetadata)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  private static serializeError(error: Error): SerializableError {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  }

  private static shouldLog(level: LogLevel): boolean {
    return level >= Logger.currentLogLevel
  }

  private static log(level: LogLevel, levelName: string, message: string, metadata?: LogMetadata): void {
    if (!Logger.shouldLog(level)) {
      return
    }

    const prefix = Logger.formatLogPrefix(levelName)
    const consoleMethod = Logger.getConsoleMethod(levelName)

    if (metadata) {
      const sanitizedMetadata = Logger.sanitizeData(metadata)
      consoleMethod(prefix, message, sanitizedMetadata)
    } else {
      consoleMethod(prefix, message)
    }
  }

  private static getConsoleMethod(levelName: string): (...args: unknown[]) => void {
    switch (levelName.toLowerCase()) {
      case 'debug':
        return console.debug
      case 'info':
        return console.info
      case 'warn':
        return console.warn
      case 'error':
        return console.error
      default:
        return console.log
    }
  }

  static debug(message: string, metadata?: LogMetadata): void {
    Logger.log(LogLevel.DEBUG, 'DEBUG', message, metadata)
  }

  static info(message: string, metadata?: LogMetadata): void {
    Logger.log(LogLevel.INFO, 'INFO', message, metadata)
  }

  static warn(message: string, metadata?: LogMetadata): void {
    Logger.log(LogLevel.WARN, 'WARN', message, metadata)
  }

  static error(message: string, metadata?: LogMetadata): void {
    Logger.log(LogLevel.ERROR, 'ERROR', message, metadata)
  }

  /**
   * Log security-related events (attacks, validation failures, suspicious activity)
   * Always logged at ERROR level for visibility in production
   * TODO: Integrate with security monitoring service (Sentry, DataDog, etc.)
   */
  static security(message: string, metadata?: LogMetadata): void {
    const securityPrefix = '[SECURITY]'
    const timestamp = Logger.formatTimestamp()
    const sanitizedMetadata = metadata ? Logger.sanitizeData(metadata) : undefined

    // Always log security events to console.error for visibility
    if (sanitizedMetadata) {
      console.error(securityPrefix, timestamp, message, sanitizedMetadata)
    } else {
      console.error(securityPrefix, timestamp, message)
    }

    // TODO: Send to security monitoring service
    // Example: Sentry.captureMessage(message, { level: 'error', extra: sanitizedMetadata })
  }
}