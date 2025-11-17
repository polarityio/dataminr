const {
  logging: { setLogger },
  errors: { parseErrorToReadableJson }
} = require('polarity-integration-utils');

const { validateOptions } = require('./server/userOptions');
const { removePrivateIps } = require('./server/dataTransformations');
const {
  pollPulseAlerts,
  resetPollingState,
  searchPulseAlerts,
  getPulseAlertById
} = require('./server/pulseAlerts');
const { getCachedAlerts, getPollingState } = require('./server/pulseAlerts/stateManager');
const { getPulseAlerts } = require('./server/pulseAlerts/getPulseAlerts');
const { setLogger: setRequestLogger } = require('./server/request');

const assembleLookupResults = require('./server/assembleLookupResults');

let pollingInterval = null;
let Logger = null;
let pollingInitialized = false;

/**
 * Initialize polling for Pulse alerts
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

  // Start polling immediately
  try {
    await pollPulseAlerts(options);
  } catch (error) {
    Logger.error({ error }, 'Initial poll failed, but continuing with interval polling');
  }

  // Set up polling interval
  const pollIntervalMs = options.pollInterval * 1000; // Convert seconds to milliseconds

  pollingInterval = setInterval(async () => {
    try {
      await pollPulseAlerts(options);
    } catch (error) {
      Logger.error({ error }, 'Error in polling interval');
    }
  }, pollIntervalMs);

  pollingInitialized = true;

  Logger.info({ pollIntervalSeconds: options.pollInterval }, 'Polling started');
};

/**
 * Perform lookup for entities and return matching alerts
 * @param {Array<Object>} entities - Array of entity objects to search for
 * @param {Object} options - Configuration options
 * @param {Function} cb - Callback function (error, results)
 * @returns {Promise<void>} Resolves when lookup is complete
 */
const doLookup = async (entities, options, cb) => {
  try {
    Logger.debug({ entities }, 'Entities');

    const searchableEntities = removePrivateIps(entities);

    const alerts = await searchPulseAlerts(searchableEntities, options);

    Logger.trace({ alerts, searchableEntities });

    const lookupResults = assembleLookupResults(entities, alerts, options);

    Logger.trace({ lookupResults }, 'Lookup Results');

    cb(null, lookupResults);
  } catch (error) {
    const err = parseErrorToReadableJson(error);

    Logger.error({ error, formattedError: err }, 'Get Lookup Results Failed');
    cb({ detail: error.message || 'Lookup Failed', err });
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
    await initializePolling(options);

    const { action } = payload;

    if (!action) {
      return cb({ detail: 'Missing action in payload' });
    }

    const username = options._request.user.username;

    switch (action) {
      case 'getAlerts':
        // Extract parameters from payload
        const { sinceTimestamp, count: countParam } = payload;
        
        // Parse count parameter (from URL or payload)
        const alertCount = countParam ? parseInt(countParam, 10) : null;
        
        // Use provided timestamp or default to current time if not provided
        const queryTimestamp = sinceTimestamp || new Date().toISOString();
        
        try {
          // Get alerts from global cache (polled alerts)
          const cachedAlerts = getCachedAlerts();
          
          // Check if we need to query API (only if count is requested and cache doesn't have enough)
          const needsApiQuery = alertCount && cachedAlerts.length < alertCount;
          
          let alerts;
          
          if (needsApiQuery) {
            Logger.debug(
              {
                username: username,
                cachedCount: cachedAlerts.length,
                requestedCount: alertCount,
                queryingApi: true
              },
              'Cache insufficient, querying API for additional alerts'
            );
            
            // Query API for alerts (count overrides timestamp for initial query)
            const { alerts: apiAlerts } = await getPulseAlerts(
              options,
              null, // No pagination cursor for user queries
              alertCount, // Count parameter (overrides timestamp if provided)
              null // Timestamp ignored when count is provided
            );
            
            // Use API alerts (they're the most recent)
            alerts = apiAlerts;
          } else {
            // Use cached alerts (already sorted newest first)
            alerts = cachedAlerts;
            
            // Filter alerts by timestamp if timestamp is provided and count is not
            // Since alerts are sorted newest first, we can use early termination
            if (queryTimestamp && !alertCount) {
              const sinceDate = new Date(queryTimestamp).getTime();
              // Use early termination since alerts are sorted newest first
              // Once we find an alert older than the timestamp, we can stop
              const filteredAlerts = [];
              for (let i = 0; i < alerts.length; i++) {
                const alert = alerts[i];
                if (!alert.alertTimestamp) {
                  continue; // Skip alerts without timestamps
                }
                const alertTime = new Date(alert.alertTimestamp).getTime();
                if (alertTime > sinceDate) {
                  filteredAlerts.push(alert);
                } else {
                  // Alerts are sorted newest first, so we can stop here
                  break;
                }
              }
              alerts = filteredAlerts;
            } else if (alertCount) {
              // Limit to requested count if count was provided
              alerts = alerts.slice(0, alertCount);
            }
            
            Logger.debug(
              {
                username: username,
                cachedCount: cachedAlerts.length,
                filteredCount: alerts.length,
                requestedCount: alertCount,
                queryingApi: false,
                usingCache: true
              },
              'Using cached alerts from polling'
            );
          }
          
          // Use the last backend poll timestamp, or current time if polling hasn't started yet
          const pollingState = getPollingState();
          const lastQueryTimestamp = pollingState.lastPollTime || new Date().toISOString();
          
          Logger.debug(
            {
              username: username,
              alertCount: alerts.length,
              queryTimestamp: queryTimestamp,
              usedCount: !!alertCount,
              usedTimestamp: !alertCount,
              lastPollTime: pollingState.lastPollTime,
              fromCache: !needsApiQuery
            },
            'Retrieved alerts for user'
          );
          
          cb(null, {
            alerts: alerts,
            count: alerts.length,
            lastQueryTimestamp: lastQueryTimestamp
          });
        } catch (error) {
          const err = parseErrorToReadableJson(error);
          Logger.error(
            { error, formattedError: err, username: username },
            'Failed to get alerts'
          );
          cb({ detail: error.message || 'Failed to get alerts', err });
        }
        break;

      case 'getAlertById':
        // Get a single alert by ID from the API
        const { alertId: requestedAlertId } = payload;
        if (!requestedAlertId) {
          return cb({ detail: 'Missing alertId in payload' });
        }
        getPulseAlertById(requestedAlertId, options)
          .then((alert) => {
            if (alert) {
              Logger.debug({ alertId: requestedAlertId }, 'Retrieved alert by ID from API');
              cb(null, { alert });
            } else {
              Logger.warn({ alertId: requestedAlertId }, 'Alert not found in API');
              cb(null, { alert: null, message: 'Alert not found' });
            }
          })
          .catch((error) => {
            const err = parseErrorToReadableJson(error);
            Logger.error({ error, formattedError: err, alertId: requestedAlertId }, 'Failed to get alert by ID');
            cb({ detail: error.message || 'Failed to get alert by ID', err });
          });
        break;

      default:
        Logger.warn({ action }, 'Unknown action in message');
        cb({ detail: `Unknown action: ${action}` });
    }
  } catch (error) {
    const err = parseErrorToReadableJson(error);
    Logger.error({ error, formattedError: err }, 'Message handling failed');
    cb({ detail: error.message || 'Message handling failed', err });
  }
};

module.exports = {
  startup,
  shutdown,
  validateOptions,
  doLookup,
  onMessage
};
