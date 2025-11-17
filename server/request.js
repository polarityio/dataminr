const { get, getOr, filter, flow, negate, isEmpty } = require('lodash/fp');

const {
  logging: { getLogger },
  requests: { PolarityRequest },
  errors: { ApiRequestError }
} = require('polarity-integration-utils');

const { DateTime } = require('luxon');

const NodeCache = require('node-cache');
const tokenCache = new NodeCache();

// Single request instance for all HTTP requests
const request = new PolarityRequest({
  roundedSuccessStatusCodes: [200],
  postprocessRequestFailure: (error) => {
    if (error instanceof ApiRequestError) {
      // Enhance error message with response details
      const errorBody = error.meta && error.meta.body;
      if (errorBody) {
        const message = errorBody.message || errorBody.errorMessage;
        if (message) {
          error.message = `${error.message} | ${message}`;
        }
      }
    }
    throw error;
  }
});

/**
 * Set the logger instance for the request module
 * @param {Object} logger - Logger instance
 * @returns {void}
 */
const setLogger = (logger) => {
  request.logger = logger;
};

/**
 * Get authentication token from Dataminr API (with caching)
 * @param {Object} options - Configuration options
 * @param {string} options.clientId - Client ID for authentication
 * @param {string} options.clientSecret - Client secret for authentication
 * @param {string} options.url - Base URL for the API
 * @returns {Promise<string>} Resolves with the authentication token
 */
const getToken = async (options) => {
  const tokenCacheKey = options.clientId + options.clientSecret;
  const cachedToken = tokenCache.get(tokenCacheKey);
  if (cachedToken) return cachedToken;

  // Set userOptions before making request
  request.userOptions = options;

  const tokenResponse = await request.run({
    method: 'POST',
    url: `${options.url}/auth/v1/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    form: {
      grant_type: 'api_key',
      client_id: options.clientId,
      client_secret: options.clientSecret
    },
    json: true
  });

  const token = tokenResponse.body.dmaToken;
  const expireTime = tokenResponse.body.expire;

  tokenCache.set(
    tokenCacheKey,
    token,
    DateTime.fromMillis(expireTime).diffNow('seconds').seconds
  );

  return token;
};

/**
 * Make an authenticated request to the Dataminr API
 * @param {Object} params - Request parameters
 * @param {string} params.route - API route (e.g., 'pulse/v1/alerts')
 * @param {Object} params.options - Configuration options
 * @param {Object} params.requestOptions - Additional request options (method, qs, headers, etc.)
 * @returns {Promise<Object>} Resolves with the response object
 */
const requestWithDefaults = async ({ route, options, ...requestOptions }) => {
  const token = await getToken(options);

  // Set userOptions before making request
  request.userOptions = options;

  const response = await request.run({
    ...requestOptions,
    url: `${options.url}/${route}`,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(requestOptions.headers || {})
    },
    json: true
  });

  return response;
};

/**
 * Execute multiple requests in parallel
 * @param {Array<Object>} requestsOptions - Array of request options, each optionally containing resultId
 * @param {string} responseGetPath - Lodash path to extract from response (e.g., 'body.alerts')
 * @param {number} limit - Maximum number of parallel requests (default: 10)
 * @param {boolean} onlyReturnPopulatedResults - If true, filter out empty/null results (default: true)
 * @returns {Promise<Array>} Resolves with array of results, optionally keyed by resultId
 */
const requestsInParallel = async (
  requestsOptions,
  responseGetPath,
  limit = 10,
  onlyReturnPopulatedResults = true
) => {
  const requestPromises = requestsOptions.map(async ({ resultId, ...requestOptions }) => {
    try {
      const response = await requestWithDefaults(requestOptions);
      const result = responseGetPath ? get(responseGetPath, response) : response;
      return resultId ? { resultId, result } : result;
    } catch (error) {
      // Log error but continue processing other requests
      console.error('Request failed:', error.message);
      return resultId ? { resultId, result: null, error: error.message } : null;
    }
  });

  const results = await Promise.all(requestPromises);

  return onlyReturnPopulatedResults
    ? filter(
        flow((result) => getOr(result, 'result', result), negate(isEmpty)),
        results
      )
    : results;
};

module.exports = {
  requestWithDefaults,
  requestsInParallel,
  setLogger
};
