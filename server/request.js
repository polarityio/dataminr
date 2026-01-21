const { map, get, getOr, filter, flow, negate, isEmpty } = require('lodash/fp');

const {
  logging: { getLogger },
  requests: { createRequestWithDefaults }
} = require('polarity-integration-utils');
const config = require('../config/config');

const { DateTime } = require('luxon');

const NodeCache = require('node-cache');
const tokenCache = new NodeCache();

const requestForAuth = createRequestWithDefaults({
  config,
  roundedSuccessStatusCodes: [200],
  requestOptionsToOmitFromLogsKeyPaths: ['form.client_id', 'form.client_secret'],
  postprocessRequestFailure: (error) => {
    try {
      const errorResponseBody = JSON.parse(error.description);
      error.message = `${error.message} - (${error.status})${
        errorResponseBody.message || errorResponseBody.errorMessage
          ? `| ${errorResponseBody.message || errorResponseBody.errorMessage}`
          : ''
      }`;
      throw error;
    } catch (parseError) {
      throw error;
    }
  }
});

const requestWithDefaults = createRequestWithDefaults({
  config,
  roundedSuccessStatusCodes: [200],
  requestOptionsToOmitFromLogsKeyPaths: ['headers.Authentication'],
  preprocessRequestOptions: async ({ route, options, ...requestOptions }) => {
    const token = await getToken(options);
    return {
      ...requestOptions,
      url: `${options.url}/${route}`,
      headers: {
        Authorization: `dmauth ${token}`
      },
      json: true
    };
  },
  postprocessRequestFailure: (error) => {
    const errorResponseBody = JSON.parse(error.description);
    error.message = `${error.message} - (${error.status})${
      errorResponseBody.message || errorResponseBody.errorMessage
        ? `| ${errorResponseBody.message || errorResponseBody.errorMessage}`
        : ''
    }`;

    throw error;
  }
});

const getToken = async (options) => {
  const tokenCacheKey = options.apiKey + options.secretKey;
  const cachedToken = tokenCache.get(tokenCacheKey);
  if (cachedToken) return cachedToken;

  const tokenResponse = get(
    'body',
    await requestForAuth({
      method: 'POST',
      url: `${options.url}/auth/2/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      form: {
        grant_type: 'api_key',
        client_id: options.clientId,
        client_secret: options.clientSecret
      },
      json: true
    })
  );

  tokenCache.set(
    tokenCacheKey,
    tokenResponse.dmaToken,
    DateTime.fromMillis(tokenResponse.expire).diffNow('seconds').seconds
  );

  return tokenResponse.dmaToken;
};

const createRequestsInParallel =
  (requestWithDefaults) =>
  async (
    requestsOptions,
    responseGetPath,
    options = {},
    onlyReturnPopulatedResults = true
  ) => {
    // Extract rate limiting options with defaults
    const maxConcurrentRequests = options.maxConcurrentRequests || 5;
    const requestDelayMs = options.requestDelayMs || 5000;

    const results = [];
    const errors = [];

    // Create unexecuted request functions
    const unexecutedRequestFunctions = map(
      ({ resultId, ...requestOptions }) =>
        async () => {
          const response = await requestWithDefaults(requestOptions);
          const result = responseGetPath ? get(responseGetPath, response) : response;
          return resultId ? { resultId, result } : result;
        },
      requestsOptions
    );

    // Process requests in batches
    const totalRequests = unexecutedRequestFunctions.length;
    for (let i = 0; i < totalRequests; i += maxConcurrentRequests) {
      const batch = unexecutedRequestFunctions.slice(i, i + maxConcurrentRequests);
      
      // Process batch concurrently
      const batchResults = await Promise.allSettled(
        batch.map(fn => fn())
      );

      // Collect results and errors from this batch
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push(result.reason);
        }
      });

      // Add delay before next batch (but not after the last batch)
      if (i + maxConcurrentRequests < totalRequests) {
        await new Promise(resolve => setTimeout(resolve, requestDelayMs));
      }
    }

    // If there were any errors, throw the first one to maintain existing error handling
    if (errors.length > 0) {
      throw errors[0];
    }

    return onlyReturnPopulatedResults
      ? filter(
          flow((result) => getOr(result, 'result', result), negate(isEmpty)),
          results
        )
      : results;
  };

const requestsInParallel = createRequestsInParallel(requestWithDefaults);

module.exports = {
  requestWithDefaults,
  requestsInParallel
};
