const { size, map, some } = require('lodash/fp');
const { getResultForThisEntity } = require('./dataTransformations');
const { MAX_PAGE_SIZE } = require('./constants');

const assembleLookupResults = (entities, alerts, options) =>
  map((entity) => {
    const resultsForThisEntity = getResultsForThisEntity(entity, alerts, options);

    const resultsFound = some(size, resultsForThisEntity);

    const lookupResult = {
      entity,
      data: resultsFound
        ? {
            summary: createSummaryTags(resultsForThisEntity, options),
            details: resultsForThisEntity
          }
        : null
    };

    return lookupResult;
  }, entities);

const getResultsForThisEntity = (entity, alerts, options) => ({
  alerts: getResultForThisEntity(entity, alerts)
});

const createSummaryTags = ({ alerts }, options) =>
  [].concat(
    size(alerts)
      ? `Alerts: ${size(alerts)}${size(alerts) === MAX_PAGE_SIZE ? '+' : ''}`
      : []
  );

module.exports = assembleLookupResults;
