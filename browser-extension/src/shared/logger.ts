// Simple logger with build-time configured log level

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  level: string;
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

const logger: Logger = (function (): Logger {
  const LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  const currentLevel = 'LOG_LEVEL_PLACEHOLDER' as LogLevel; // Replaced at build time
  const levelValue = LEVELS[currentLevel] || LEVELS.warn; // Fallback to warn for unknown levels

  return {
    level: currentLevel,

    debug: function (...args: any[]): void {
      if (levelValue <= LEVELS.debug) {
        console.log('[DEBUG]', ...args);
      }
    },

    info: function (...args: any[]): void {
      if (levelValue <= LEVELS.info) {
        console.info('[INFO]', ...args);
      }
    },

    warn: function (...args: any[]): void {
      if (levelValue <= LEVELS.warn) {
        console.warn('[WARN]', ...args);
      }
    },

    error: function (...args: any[]): void {
      console.error('[ERROR]', ...args); // Always log errors
    }
  };
})();

// Logger is available as a global variable for browser extension use
