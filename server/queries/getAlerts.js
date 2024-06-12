const { map } = require('lodash/fp');

const {
  logging: { getLogger },
  errors: { parseErrorToReadableJson }
} = require('polarity-integration-utils');

const { requestsInParallel } = require('../request');

const { MAX_PAGE_SIZE } = require('../constants');

const getAlerts = async (entities, options) => {
  const Logger = getLogger();

  try {
    const alertsRequests = map(
      (entity) => ({
        resultId: entity.value,
        route: `api/3/alerts`,
        qs: {
          query: entity.value,
          alertversion: 14,
          num: MAX_PAGE_SIZE
        },
        options
      }),
      entities
    );

    const alerts = await requestsInParallel(alertsRequests, 'body.data.alerts');

    return alerts;
  } catch (error) {
    const err = parseErrorToReadableJson(error);
    Logger.error(
      {
        formattedError: err,
        error
      },
      'Getting Alerts Failed'
    );
    throw error;
  }
};

module.exports = getAlerts;
