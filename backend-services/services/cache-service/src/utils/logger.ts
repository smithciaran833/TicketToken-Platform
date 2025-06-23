import pino from 'pino';

export class Logger {
  private logger: pino.Logger;

  constructor(service: string) {
    this.logger = pino({
      name: service,
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(meta, message);
  }

  error(message: string, meta?: any): void {
    this.logger.error(meta, message);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(meta, message);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(meta, message);
  }
}
