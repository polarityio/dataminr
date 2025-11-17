const searchPulseAlerts = require('./searchPulseAlerts');
const { getPulseAlerts, getPulseAlertById } = require('./getPulseAlerts');
const pollPulseAlerts = require('./pollPulseAlerts');

const {
  resetPollingState,
  getCachedAlerts,
  getCachedAlertCount,
  addAlertsToCache,
  clearCachedAlerts
} = require('./stateManager');

module.exports = {
  searchPulseAlerts,
  getPulseAlerts,
  getPulseAlertById,
  pollPulseAlerts,
  resetPollingState,
  getCachedAlerts,
  getCachedAlertCount,
  addAlertsToCache,
  clearCachedAlerts
};
