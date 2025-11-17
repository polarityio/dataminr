const { map } = require('lodash/fp');

const {
  logging: { getLogger },
  errors: { parseErrorToReadableJson }
} = require('polarity-integration-utils');

const { requestsInParallel } = require('../request');
const { MAX_PAGE_SIZE } = require('../constants');

/**
 * Search for Pulse alerts matching the given entities
 * @param {Array<Object>} entities - Array of entity objects to search for
 * @param {Object} options - Configuration options
 * @returns {Promise<Array<Object>>} Resolves with array of alert results
 */
const searchPulseAlerts = async (entities, options) => {
  const Logger = getLogger();

  try {
    const alertsRequests = map(
      (entity) => ({
        resultId: entity.value,
        route: `pulse/v1/alerts`,
        qs: {
          query: entity.value,
          pageSize: MAX_PAGE_SIZE
        },
        options
      }),
      entities
    );

    const alerts = await requestsInParallel(alertsRequests, 'body.alerts');

    return alerts;
  } catch (error) {
    const err = parseErrorToReadableJson(error);
    Logger.error(
      {
        formattedError: err,
        error
      },
      'Searching Pulse Alerts Failed'
    );
    throw error;
  }
};

module.exports = searchPulseAlerts;
