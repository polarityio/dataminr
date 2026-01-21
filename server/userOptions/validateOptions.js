const { validateStringOptions, validateUrlOption } = require('./utils');

const validateOptions = async (options, callback) => {
  const stringOptionsErrorMessages = {
    url: '* Required',
    clientId: '* Required',
    clientSecret: '* Required'
  };

  const stringValidationErrors = validateStringOptions(
    stringOptionsErrorMessages,
    options
  );

  const urlValidationError = validateUrlOption(options, 'url');

  let errors = stringValidationErrors.concat(urlValidationError);

  // Validate maxConcurrentRequests
  const maxConcurrentRequests = options.maxConcurrentRequests.value;
  if (typeof maxConcurrentRequests !== 'number' || maxConcurrentRequests < 1 || maxConcurrentRequests > 10) {
    errors = errors.concat({
      key: 'maxConcurrentRequests',
      message: 'Must be a number between 1 and 10'
    });
  }

  // Validate requestDelayMs
  const requestDelayMs = options.requestDelayMs.value;
  if (typeof requestDelayMs !== 'number' || requestDelayMs < 0) {
    errors = errors.concat({
      key: 'requestDelayMs',
      message: 'Must be a non-negative number'
    });
  }

  callback(null, errors);
};

module.exports = validateOptions;
