module.exports = {
  DEFAULT_PAGE_SIZE: 40,
  CACHE_MAX_AGE_MS: 30 * 60 * 1000, // 30 minutes in milliseconds
  STATE_KEY: 'pollingState',
  ALERTS_KEY: 'alerts',
  ROUTE_PREFIX: 'pulse',
  DEFAULT_ALERT_TYPES_TO_WATCH: ['flash', 'urgent', 'alert'],
  TRIAL_MODE: false
};