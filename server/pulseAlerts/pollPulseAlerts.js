const {
  logging: { getLogger },
  errors: { parseErrorToReadableJson }
} = require('polarity-integration-utils');

const { getPulseAlerts } = require('./getPulseAlerts');
const { getPollingState, updatePollingState } = require('./stateManager');
const { processAlerts } = require('./alertProcessor');

/**
 * Poll the Pulse API for new alerts and process them
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Resolves with polling result object
 * @returns {boolean} returns.success - Whether polling was successful
 * @returns {number} returns.alertsProcessed - Number of alerts processed
 * @returns {boolean} returns.hasMore - Whether there are more alerts to fetch
 * @returns {string} [returns.error] - Error message if polling failed
 */
const pollPulseAlerts = async (options) => {
  const Logger = getLogger();

  try {
    Logger.debug('Starting Pulse API poll');

    const state = getPollingState();
    let paginationCursor = null;

    // Fetch alerts from Pulse API
    const { alerts, nextPage } = await getPulseAlerts(options, paginationCursor);

    // Process the alerts
    if (alerts.length > 0) {
      await processAlerts(alerts, options);
    }

    // Extract cursor from nextPage URL for next poll
    // nextPage format: /v1/alerts?lists=12345&from=2wVWwq3bBSqy%2FtkFROaX2wUysoSh&pageSize=10
    let newCursor = null;
    if (nextPage) {
      try {
        const urlParts = nextPage.split('?');
        if (urlParts.length > 1) {
          const urlParams = new URLSearchParams(urlParts[1]);
          newCursor = urlParams.get('from');
        }
      } catch (error) {
        Logger.warn({ error, nextPage }, 'Failed to parse nextPage URL for cursor');
      }
    }

    // Update polling state
    updatePollingState({
      lastCursor: newCursor || paginationCursor,
      alertCount: alerts.length,
      totalAlertsProcessed: state.totalAlertsProcessed + alerts.length
    });

    Logger.debug(
      {
        newCursor,
        totalProcessed: state.totalAlertsProcessed + alerts.length
      },
      'Polling cycle completed'
    );

    return {
      success: true,
      alertsProcessed: alerts.length,
      hasMore: !!nextPage
    };
  } catch (error) {
    const err = parseErrorToReadableJson(error);
    Logger.error(
      {
        formattedError: err,
        error
      },
      'Polling Pulse API Failed'
    );

    // Don't throw - allow polling to continue on next interval
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = pollPulseAlerts;
