/**
 * src/logger.js
 *
 * Lightweight, structured logger for tracking application flow,
 * function execution, and component health.
 */

'use strict';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

const currentLevelName = (
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info')
).toLowerCase();

const currentLevel = LOG_LEVELS[currentLevelName] !== undefined
  ? LOG_LEVELS[currentLevelName]
  : LOG_LEVELS.info;

function formatMessage(level, namespace, message, meta) {
  const timestamp = new Date().toISOString();
  const prefix = namespace ? `[${namespace}]` : '';
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${prefix} ${message}${metaStr}`.trim();
}

class Logger {
  constructor(namespace = '') {
    this.namespace = namespace;
  }

  debug(message, meta = {}) {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.debug(formatMessage('debug', this.namespace, message, meta));
    }
  }

  info(message, meta = {}) {
    if (currentLevel <= LOG_LEVELS.info) {
      console.info(formatMessage('info', this.namespace, message, meta));
    }
  }

  warn(message, meta = {}) {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', this.namespace, message, meta));
    }
  }

  error(message, meta = {}) {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(formatMessage('error', this.namespace, message, meta));
    }
  }

  child(subNamespace) {
    const combined = this.namespace
      ? `${this.namespace}:${subNamespace}`
      : subNamespace;
    return new Logger(combined);
  }
}

const defaultLogger = new Logger('susu');

module.exports = defaultLogger;
module.exports.Logger = Logger;
module.exports.createLogger = (namespace) => new Logger(namespace);
