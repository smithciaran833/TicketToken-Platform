export class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  info(message: string, data?: any) {
    console.log(`[${new Date().toISOString()}] [${this.service}] INFO: ${message}`, data || '');
  }

  error(message: string, error?: any) {
    console.error(`[${new Date().toISOString()}] [${this.service}] ERROR: ${message}`, error || '');
  }

  warn(message: string, data?: any) {
    console.warn(`[${new Date().toISOString()}] [${this.service}] WARN: ${message}`, data || '');
  }

  debug(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${new Date().toISOString()}] [${this.service}] DEBUG: ${message}`, data || '');
    }
  }
}
