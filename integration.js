const {
  logging: { setLogger },
  errors: { parseErrorToReadableJson }
} = require('polarity-integration-utils');

const { validateOptions } = require('./server/userOptions');
const { removePrivateIps } = require('./server/dataTransformations');
const {
  pollAlerts,
  resetPollingState,
  searchAlerts,
  getAlertById
} = require('./server/alerts');
const {
  getCachedAlerts,
  getLatestAlertTimestamp
} = require('./server/alerts/stateManager');
const { getAlerts } = require('./server/alerts/getAlerts');
const { setLogger: setRequestLogger } = require('./server/request');
const {
  renderAlertDetail,
  renderAlertNotification
} = require('./server/templateRenderer');
const { getLists } = require('./server/alerts/getLists');

const assembleLookupResults = require('./server/assembleLookupResults');
const {
  ROUTE_PREFIX,
  DEFAULT_ALERT_TYPES_TO_WATCH,
  TRIAL_MODE
} = require('./server/constants');

let pollingInterval = null;
let Logger = null;
let pollingInitialized = false;
let cachedLists = null; // Cache for lists to return immediately

/**
 * Initialize polling for alerts
 * @param {Object} options - Configuration options containing clientId, clientSecret, and pollInterval
 * @returns {Promise<void>} Resolves when polling is initialized
 */
const initializePolling = async (options) => {
  if (pollingInitialized) {
    return;
  }

  // Validate that required options are present
  if (!options.clientId || !options.clientSecret) {
    Logger.warn('Client ID or Client Secret not configured. Polling will not start.');
    Logger.debug('Options', options);
    return;
  }

  // Reset polling state on first initialization
  resetPollingState();

  // Add route prefix to options
  const optionsWithRoute = { ...options, routePrefix: ROUTE_PREFIX };

  pollAlerts(optionsWithRoute);

  // Set up polling interval
  const pollIntervalMs = options.pollInterval * 1000; // Convert seconds to milliseconds

  pollingInterval = setInterval(async () => {
    try {
      pollAlerts(optionsWithRoute);
    } catch (error) {
      Logger.error({ error }, 'Error in polling interval');
    }
  }, pollIntervalMs);

  pollingInitialized = true;

  Logger.info({ pollIntervalSeconds: options.pollInterval }, 'Polling started');
};

/**
 * Perform Pulse lookup for entities and return matching alerts
 * @param {Array<Object>} entities - Array of entity objects to search for
 * @param {Object} options - Configuration options
 * @param {Function} cb - Callback function (error, results)
 * @returns {Promise<void>} Resolves when lookup is complete
 */
const doLookup = async (entities, options, cb) => {
  try {
    // Only gets run in the Pulse integration - FirstAlert has no configured entities
    Logger.debug({ entities }, 'Entities');

    const searchableEntities = removePrivateIps(entities);

    // Add route prefix to options
    const optionsWithRoute = { ...options, routePrefix: ROUTE_PREFIX };
    const alerts = await searchAlerts(searchableEntities, optionsWithRoute);

    Logger.trace({ alerts, searchableEntities });

    let lookupResults;
    if (!TRIAL_MODE) {
      lookupResults = await assembleLookupResults(entities, alerts, options);
    } else {
      // For trial version: return count with trial message instead of real results
      lookupResults = entities.map((entity) => {
        // Find alerts for this entity (alerts structure: [{resultId, result: [...]}, ...])
        const entityResult = alerts.find(
          (alertResult) => alertResult.resultId === entity.value
        );
        const alertCount =
          entityResult && Array.isArray(entityResult.result)
            ? entityResult.result.length
            : 0;

        return {
          entity,
          data:
            alertCount > 0
              ? {
                  summary: [`Alerts: ${alertCount}`],
                  details: {
                    trialSearch: true,
                    alertCount: alertCount,
                    alerts: [] // Empty array - no real results for trial
                  }
                }
              : null
        };
      });
    }

    Logger.trace({ lookupResults }, 'Lookup Results');

    cb(null, lookupResults);
  } catch (error) {
    const err = parseErrorToReadableJson(error);

    Logger.error({ error, formattedError: err }, 'Get Lookup Results Failed');
    cb({ detail: error?.detail || error?.message || 'Lookup Failed', err });
  }
};

/**
 * Initialize the integration on startup
 * @param {Object} logger - Logger instance for logging
 * @returns {Promise<void>} Resolves when startup is complete
 */
const startup = async (logger) => {
  Logger = logger;

  // Set up logger
  setLogger(Logger);
  setRequestLogger(Logger);

  Logger.warn('Dataminr integration starting up');
  // Polling will be initialized on first doLookup call when options are available
};

/**
 * Cleanup resources and stop polling on shutdown
 * @returns {void}
 */
const shutdown = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    pollingInitialized = false;
    Logger.info('Polling stopped');
  }
};

/**
 * Create a filter function for alert types based on configuration
 * @param {Object} options - Configuration options
 * @returns {Function} Filter function that returns true if alert should be included
 */
const createAlertTypeFilter = (options) => {
  // Get configured alert types to watch (default to all if not configured)
  const alertTypesToWatch =
    options.setAlertTypesToWatch && options.setAlertTypesToWatch.length > 0
      ? options.setAlertTypesToWatch
      : DEFAULT_ALERT_TYPES_TO_WATCH;

  // Normalize to lowercase for comparison
  // Handle both string arrays and object arrays with {value, display} structure
  const normalizedAlertTypesToWatch = alertTypesToWatch.map((type) => {
    // If it's an object with a value property, use that
    if (type && typeof type === 'object' && type.value) {
      return typeof type.value === 'string'
        ? type.value.toLowerCase()
        : String(type.value).toLowerCase();
    }
    // Otherwise treat as string
    return typeof type === 'string' ? type.toLowerCase() : String(type).toLowerCase();
  });

  // Return filter function that checks if alert type should be included
  return (alert) => {
    if (!normalizedAlertTypesToWatch || normalizedAlertTypesToWatch.length === 0) {
      return true; // Include all if no filter configured
    }
    const alertTypeName =
      alert.alertType && alert.alertType.name
        ? alert.alertType.name.toLowerCase()
        : 'alert';
    return normalizedAlertTypesToWatch.indexOf(alertTypeName) !== -1;
  };
};

/**
 * Handle incoming messages from the client
 * @param {Object} payload - Message payload containing action and other data
 * @param {string} payload.action - Action to perform ('getAlerts', 'getAlertById')
 * @param {string} payload.sinceTimestamp - Optional ISO timestamp to filter alerts (returns alerts after this timestamp)
 * @param {number} payload.count - Optional number of alerts to return (overrides timestamp on first query)
 * @param {string} payload.alertId - Optional alert ID to get
 * @param {Object} options - Configuration options
 * @param {Function} cb - Callback function (error, result)
 * @returns {Promise<void>} Resolves when message is handled
 */
const onMessage = async (payload, options, cb) => {
  try {
    // Initialize polling on first message if not already initialized
    initializePolling(options);

    const { action } = payload;

    if (!action) {
      return cb({ detail: 'Missing action in payload' });
    }

    const username = options._request.user.username;

    switch (action) {
      case 'getAlerts':
        // Extract parameters from payload
        const { sinceTimestamp, count: countParam } = payload;

        // Use the latest alert timestamp for filtering consistency
        const lastAlertTimestamp = getLatestAlertTimestamp() || new Date().toISOString();

        // Parse count parameter (from URL or payload)
        const alertCount = countParam ? parseInt(countParam, 10) : null;

        let listIds = null;
        if (
          options.setListsToWatch &&
          Array.isArray(options.setListsToWatch) &&
          options.setListsToWatch.length > 0
        ) {
          // Extract listIds from user options
          listIds = options.setListsToWatch
            .map((list) => list.value)
            .filter((id) => id && id !== '0');
          // If listIds is empty after filtering, set to null (no filtering)
          if (listIds.length === 0) {
            listIds = null;
          }
        }

        // Use provided timestamp or default to current time if not provided
        // If alertCount is provided, don't filter by timestamp (return null)
        const alertFilterTimestamp = alertCount
          ? null
          : sinceTimestamp || new Date().toISOString();

        // Create alert type filter function
        const alertTypeFilter = createAlertTypeFilter(options);

        try {
          // Get alerts from global cache (filtered by listIds if provided)
          const cachedAlerts = getCachedAlerts(listIds, alertFilterTimestamp);
          // Filter cached alerts by alert type
          let alerts = cachedAlerts.filter(alertTypeFilter);

          // Check if we need to query API (only if count is requested and cache doesn't have enough)
          if (alertCount && alerts.length < alertCount) {
            // Create options with listIds and route prefix for API query
            const queryOptions = {
              ...options,
              listIds: listIds,
              routePrefix: ROUTE_PREFIX
            };

            try {
              // Query API for alerts (count overrides timestamp for initial query)
              const { alerts: apiAlerts } = await getAlerts(
                queryOptions,
                (count = alertCount) // Count parameter (overrides timestamp if provided)
              );

              // Filter API alerts by alert type
              // Note: Since we currently filter by alert type after getAlerts, we could have less than the requested count
              alerts = apiAlerts.filter(alertTypeFilter);
            } catch (apiError) {
              const errorStatus =
                apiError?.status || apiError?.statusCode || apiError?.meta?.statusCode;
              if (errorStatus === 429 || errorStatus === '429') {
                Logger.warn(
                  { username },
                  'Rate limit encountered, returning cached alerts'
                );
              } else {
                throw apiError;
              }
            }
          }

          if (alertCount) {
            // Limit to requested count if count was provided
            alerts = alerts.slice(0, alertCount);
          }

          cb(null, {
            alerts: alerts,
            count: alerts.length,
            lastAlertTimestamp: lastAlertTimestamp
          });
        } catch (error) {
          const err = parseErrorToReadableJson(error);
          Logger.error(
            { error, formattedError: err, username: username },
            'Failed to get alerts'
          );
          cb({
            detail: error?.detail || error?.message || 'Failed to get alerts',
            ...(error?.status && { status: error.status }),
            ...(err && typeof err === 'object' && !Array.isArray(err) && { err })
          });
        }
        break;

      case 'getAlertById':
        // Get a single alert by ID from the API
        const { alertId: requestedAlertId } = payload;
        if (!requestedAlertId) {
          return cb({ detail: 'Missing alertId in payload' });
        }
        // Add route prefix to options
        const optionsWithRouteForAlert = { ...options, routePrefix: ROUTE_PREFIX };
        getAlertById(requestedAlertId, optionsWithRouteForAlert)
          .then((alert) => {
            if (alert) {
              Logger.debug(
                { alertId: requestedAlertId },
                'Retrieved alert by ID from API'
              );
              cb(null, { alert });
            } else {
              Logger.warn({ alertId: requestedAlertId }, 'Alert not found in API');
              cb(null, { alert: null, message: 'Alert not found' });
            }
          })
          .catch((error) => {
            const err = parseErrorToReadableJson(error);
            Logger.error(
              { error, formattedError: err, alertId: requestedAlertId },
              'Failed to get alert by ID'
            );
            cb({
              detail: error?.detail || error?.message || 'Failed to get alert by ID',
              err
            });
          });
        break;

      case 'renderAlertDetail':
        // Render alert detail HTML using handlebars template
        const { alert: alertToRender, timezone: payloadTimezone } = payload;
        if (!alertToRender) {
          return cb({ detail: 'Missing alert in payload' });
        }

        // Merge timezone from payload into options if provided
        const optionsWithTimezone = payloadTimezone
          ? Object.assign({}, options, { timezone: payloadTimezone })
          : options;

        renderAlertDetail(alertToRender, optionsWithTimezone)
          .then((renderedHtml) => {
            Logger.debug(
              { alertId: alertToRender.alertId },
              'Rendered alert detail template'
            );
            cb(null, { html: renderedHtml });
          })
          .catch((error) => {
            const err = parseErrorToReadableJson(error);
            Logger.error(
              { error, formattedError: err, alertId: alertToRender.alertId },
              'Failed to render alert detail template'
            );
            cb({
              detail: error?.message || 'Failed to render alert detail template',
              err
            });
          });
        break;

      case 'renderAlertNotification':
        // Render alert notification HTML using handlebars template
        try {
          const renderedHtml = renderAlertNotification(payload.name);
          Logger.debug('Rendered alert notification template');
          cb(null, { html: renderedHtml });
        } catch (error) {
          const err = parseErrorToReadableJson(error);
          Logger.error(
            { error, formattedError: err },
            'Failed to render alert notification template'
          );
          cb({
            detail: error?.message || 'Failed to render alert notification template',
            err
          });
        }
        break;

      case 'getLists':
        // Get lists from Dataminr API
        // Return cached lists immediately (or empty array if no cache) - non-blocking
        cb(null, { lists: cachedLists || [] });

        // Fetch lists in background to update cache for next request
        const optionsWithRouteForLists = { ...options, routePrefix: ROUTE_PREFIX };
        getLists(optionsWithRouteForLists)
          .then((lists) => {
            cachedLists = lists; // Update cache
            Logger.debug(
              { listCount: lists.length },
              'Retrieved lists from API (background, cache updated)'
            );
          })
          .catch((error) => {
            // This should never happen since getLists returns empty array on error
            // But keeping for safety
            const err = parseErrorToReadableJson(error);
            Logger.error({ error, formattedError: err }, 'Unexpected error in getLists');
            cb(null, { lists: [] });
          });
        break;

      default:
        Logger.warn({ action }, 'Unknown action in message');
        cb({ detail: `Unknown action: ${action}` });
    }
  } catch (error) {
    const err = parseErrorToReadableJson(error);
    Logger.error({ error, formattedError: err }, 'Message handling failed');
    cb({ detail: error?.detail || error?.message || 'Message handling failed', err });
  }
};

module.exports = {
  startup,
  shutdown,
  validateOptions,
  doLookup,
  onMessage
};
