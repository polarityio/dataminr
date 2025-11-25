const searchPulseAlerts = require('./searchPulseAlerts');
const { getPulseAlerts, getPulseAlertById } = require('./getPulseAlerts');
const { getPulseLists } = require('./getPulseLists');
const pollPulseAlerts = require('./pollPulseAlerts');

const {
  resetPollingState,
  getCachedAlerts,
  addAlertsToCache,
  clearCachedAlerts
} = require('./stateManager');

module.exports = {
  searchPulseAlerts,
  getPulseAlerts,
  getPulseLists,
  getPulseAlertById,
  pollPulseAlerts,
  resetPollingState,
  getCachedAlerts,
  addAlertsToCache,
  clearCachedAlerts
};
