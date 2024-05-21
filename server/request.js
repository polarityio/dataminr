const { map, get, getOr, filter, flow, negate, isEmpty } = require('lodash/fp');
const { parallelLimit } = require('async');

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
    const errorResponseBody = JSON.parse(error.description);
    error.message = `${error.message} - (${error.status})${
      errorResponseBody.message || errorResponseBody.errorMessage
        ? `| ${errorResponseBody.message || errorResponseBody.errorMessage}`
        : ''
    }`;

    throw error;
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
    limit = 10,
    onlyReturnPopulatedResults = true
  ) => {
    const unexecutedRequestFunctions = map(
      ({ resultId, ...requestOptions }) =>
        async () => {
          const response = await requestWithDefaults(requestOptions);
          const result = responseGetPath ? get(responseGetPath, response) : response;
          return resultId ? { resultId, result } : result;
        },
      requestsOptions
    );

    const results = await parallelLimit(unexecutedRequestFunctions, limit);

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
