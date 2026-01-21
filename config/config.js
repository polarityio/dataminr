module.exports = {
  name: 'Dataminr',
  acronym: 'DM',
  description: 'Search Dataminr by all entities to get related Alerts',
  entityTypes: [
    'domain',
    'IPv4',
    'IPv6',
    'IPv4CIDR',
    'email',
    'MD5',
    'SHA1',
    'SHA256',
    'cve',
    'url'
  ],
  customTypes: [
    {
      key: 'allText',
      regex: /\S[\s\S]{2,256}\S/
    }
  ],
  styles: ['./client/styles.less'],
  defaultColor: 'light-blue',
  onDemandOnly: true,
  block: {
    component: {
      file: './client/block.js'
    },
    template: {
      file: './client/block.hbs'
    }
  },
  request: {
    cert: '',
    key: '',
    passphrase: '',
    ca: '',
    proxy: ''
  },
  logging: {
    level: 'info'
  },
  options: [
    {
      key: 'url',
      name: 'Dataminr API URL',
      description:
        'The base URL of the Dataminr API including the schema (i.e., https://)',
      default: 'https://gateway.dataminr.com',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'clientId',
      name: 'Client ID',
      description: 'Your Client ID Credential',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'clientSecret',
      name: 'Client Secret',
      description: 'Your Client Secret Credential',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'maxConcurrentRequests',
      name: 'Max Concurrent Requests',
      description: 'Maximum number of concurrent requests to send to the Dataminr API at once. Should not exceed your rate limit (default: 6 requests per 30 seconds).',
      default: 5,
      type: 'number',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'requestDelayMs',
      name: 'Request Delay (milliseconds)',
      description: 'Delay in milliseconds between batches of requests to respect rate limits. Recommended: 5000ms (5 seconds) to stay within 6 requests per 30 seconds.',
      default: 5000,
      type: 'number',
      userCanEdit: false,
      adminOnly: true
    }
  ]
};
