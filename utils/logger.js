/**
 * Simple leveled logger.
 * In production, can be redirected to a file.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT = process.env.LOG_LEVEL || 'info';

function format(level, msg, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  if (meta && Object.keys(meta).length) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

function shouldLog(level) {
  return LEVELS[level] <= LEVELS[CURRENT];
}

module.exports = {
  error: (msg, meta) => shouldLog('error') && console.error(format('error', msg, meta)),
  warn:  (msg, meta) => shouldLog('warn')  && console.warn(format('warn', msg, meta)),
  info:  (msg, meta) => shouldLog('info')  && console.log(format('info', msg, meta)),
  debug: (msg, meta) => shouldLog('debug') && console.log(format('debug', msg, meta))
};
