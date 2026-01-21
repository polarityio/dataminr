const { get, getOr, filter, flow, negate, isEmpty } = require('lodash/fp');

const {
  logging: { getLogger },
  requests: { PolarityRequest },
  errors: { ApiRequestError }
} = require('polarity-integration-utils');

const { DateTime } = require('luxon');

const NodeCache = require('node-cache');
const tokenCache = new NodeCache();

// Rate limiter state - tracks API rate limit info from response headers
const rateLimitState = {
  limit: 6, // Default: 6 requests per window
  remaining: 6, // Default: start with full quota
  resetAt: null, // Timestamp when rate limit resets
  windowMs: 30000 // Default: 30 second window
};

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Update rate limit state from response headers
 * @param {Object} response - HTTP response object
 * @returns {void}
 */
const updateRateLimitFromHeaders = (response) => {
  const Logger = getLogger();
  const headers = response.headers || {};
  
  const limit = headers['x-ratelimit-limit'];
  const remaining = headers['x-ratelimit-remaining'];
  const reset = headers['x-ratelimit-reset'];
  
  if (limit !== undefined) {
    rateLimitState.limit = parseInt(limit, 10);
  }
  
  if (remaining !== undefined) {
    rateLimitState.remaining = parseInt(remaining, 10);
  }
  
  if (reset !== undefined) {
    const resetMs = parseInt(reset, 10);
    rateLimitState.resetAt = Date.now() + resetMs;
  }
  
  Logger.trace(
    {
      limit: rateLimitState.limit,
      remaining: rateLimitState.remaining,
      resetAt: rateLimitState.resetAt,
      resetIn: rateLimitState.resetAt ? rateLimitState.resetAt - Date.now() : null
    },
    'Updated rate limit state from response headers'
  );
};

/**
 * Check if we should wait before making a request based on rate limit state
 * @returns {Promise<void>} Resolves after waiting if necessary
 */
const checkRateLimit = async () => {
  const Logger = getLogger();
  const now = Date.now();
  
  // Check if rate limit has reset
  if (rateLimitState.resetAt && now >= rateLimitState.resetAt) {
    Logger.trace('Rate limit window has reset');
    rateLimitState.remaining = rateLimitState.limit;
    rateLimitState.resetAt = null;
  }
  
  // If we have remaining quota, proceed
  if (rateLimitState.remaining > 0) {
    // Optimistically decrement (will be corrected by response headers)
    rateLimitState.remaining--;
    return;
  }
  
  // No quota remaining - wait until reset
  if (rateLimitState.resetAt && rateLimitState.resetAt > now) {
    const waitTime = rateLimitState.resetAt - now;
    Logger.warn(
      {
        waitTimeMs: waitTime,
        resetAt: new Date(rateLimitState.resetAt).toISOString(),
        limit: rateLimitState.limit
      },
      'Rate limit exhausted - waiting until reset'
    );
    await sleep(waitTime);
    
    // After waiting, reset the quota
    rateLimitState.remaining = rateLimitState.limit;
    rateLimitState.resetAt = null;
  } else if (rateLimitState.remaining === 0) {
    // No reset time known, use default window
    const waitTime = rateLimitState.windowMs;
    Logger.warn(
      {
        waitTimeMs: waitTime,
        limit: rateLimitState.limit
      },
      'Rate limit exhausted with no reset time - waiting default window'
    );
    await sleep(waitTime);
    
    // Reset quota after default wait
    rateLimitState.remaining = rateLimitState.limit;
  }
};

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
 * Clear cached token for the given options
 * @param {Object} options - Configuration options
 * @returns {void}
 */
const clearToken = (options) => {
  const tokenCacheKey = options.clientId + options.clientSecret;
  tokenCache.del(tokenCacheKey);
};

/**
 * Get authentication token from Dataminr API (with caching)
 * @param {Object} options - Configuration options
 * @param {string} options.clientId - Client ID for authentication
 * @param {string} options.clientSecret - Client secret for authentication
 * @param {string} options.url - Base URL for the API
 * @param {boolean} [forceRefresh=false] - If true, bypass cache and get a new token
 * @returns {Promise<string>} Resolves with the authentication token
 */
const getToken = async (options, forceRefresh = false) => {
  const tokenCacheKey = options.clientId + options.clientSecret;
  
  if (forceRefresh) {
    tokenCache.del(tokenCacheKey);
  } else {
    const cachedToken = tokenCache.get(tokenCacheKey);
    if (cachedToken) return cachedToken;
  }

  // Set userOptions before making request
  request.userOptions = options;

  try {
    const tokenResponse = await request.run({
      method: 'POST',
      url: `${options.url}/auth/v1/token`,
      headers: {
        'X-Application-Name': 'Polarity',
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
  } catch (error) {
    const message = 'Failed to retrieve auth token - invalid clientId / clientSecret: ';
    if (error.name === 'ApiRequestError' && error.detail) {
      error.detail = message + error.detail;
    } else if (error.errors && Array.isArray(error.errors)) {
      error.errors = error.errors.map((error) => {
        if (error.message) {
          error.message = message + error.message;
        }
        return error;
      });
    }
    throw error;
  }
};

/**
 * Make an authenticated request to the Dataminr API with retry logic for rate limiting
 * @param {Object} params - Request parameters
 * @param {string} params.route - API route (e.g., '.../v1/alerts')
 * @param {Object} params.options - Configuration options
 * @param {Object} params.requestOptions - Additional request options (method, qs, headers, etc.)
 * @param {number} [maxRetries=3] - Maximum number of retry attempts for 429 errors (default: 3)
 * @returns {Promise<Object>} Resolves with the response object
 */
const requestWithDefaults = async ({ route, options, maxRetries = 3, ...requestOptions }) => {
  const Logger = getLogger();
  let token = await getToken(options);
  let tokenRefreshed = false;

  // Set userOptions before making request
  request.userOptions = options;

  let lastError;
  let attemptNumber = 0;

  // Wrap the request execution with rate limiting
  const executeRequest = async () => {
    // Check rate limit before making request
    await checkRateLimit();
    
    while (attemptNumber <= maxRetries) {
      try {
        const response = await request.run({
          ...requestOptions,
          url: `${options.url}/${route}`,
          headers: {
            'X-Application-Name': 'Polarity',
            Authorization: `Bearer ${token}`,
            ...(requestOptions.headers || {})
          },
          json: true
        });

        // Update rate limit state from response headers
        updateRateLimitFromHeaders(response);

        return response;
      } catch (error) {
        lastError = error;

        // Update rate limit state from error response headers if available
        if (error.meta && error.meta.headers) {
          updateRateLimitFromHeaders({ headers: error.meta.headers });
        }

        // Check if it's a 401 authentication error
        const errorStatus = error.status || error.statusCode || (error.meta && error.meta.statusCode);
        const isUnauthorizedError =
          (error instanceof ApiRequestError || error.name === 'ApiRequestError') &&
          (errorStatus === '401' || errorStatus === 401);

        // If we get a 401 and haven't refreshed the token yet, try to get a new token and retry once
        if (isUnauthorizedError && !tokenRefreshed) {
          Logger.warn(
            { route, errorStatus },
            'Received 401 unauthorized error, attempting to refresh token'
          );

          try {
            // Clear the cached token and get a new one
            clearToken(options);
            token = await getToken(options, true);
            tokenRefreshed = true;

            // Retry the request with the new token
            attemptNumber++;
            continue;
          } catch (tokenError) {
            // If getting a new token fails (e.g., invalid credentials), throw immediately
            // Don't retry as this indicates a configuration issue, not an expired token
            Logger.error(
              { route, tokenError },
              'Failed to refresh token, credentials may be invalid'
            );
            throw tokenError;
          }
        }

        // Check if it's a 429 rate limit error
        const isRateLimitError =
          (error instanceof ApiRequestError || error.name === 'ApiRequestError') &&
          (errorStatus === '429' || errorStatus === 429 || String(error.message || error.detail || '').includes('429'));

        if (isRateLimitError && attemptNumber < maxRetries) {
          // Use x-ratelimit-reset from headers if available
          const resetMs = error.meta?.headers?.['x-ratelimit-reset'];
          const retryDelay = resetMs ? parseInt(resetMs, 10) : Math.min(Math.pow(2, attemptNumber), 60) * 1000;
          
          Logger.warn(
            { route, attemptNumber: attemptNumber + 1, maxRetries, retryDelayMs: retryDelay },
            'Rate limit (429) encountered, retrying request'
          );

          await sleep(retryDelay);
          attemptNumber++;
          continue;
        }

        throw error;
      }
    }

    // If we've exhausted all retries, throw the last error
    Logger.error(
      {
        route,
        maxRetries,
        finalAttempt: attemptNumber
      },
      'Max retries exceeded for rate-limited request'
    );
    throw lastError;
  };

  return await executeRequest();
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
