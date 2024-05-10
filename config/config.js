module.exports = {
  name: 'Dataminr',
  acronym: 'DM',
  description:
    'TODO',
  entityTypes: ['*'],
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
      name: 'Flashpoint API URL',
      description:
        'The base URL of the Flashpoint API including the schema (i.e., https://)',
      default: 'https://api.flashpoint.io',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'apiKey',
      name: 'API Key',
      description: 'Valid Flashpoint API Key',
      default: '',
      type: 'password',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'limit',
      name: 'Result Limit',
      description: 'The maximum amount of results to be returned per query',
      default: 10,
      type: 'number',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'blocklist',
      name: 'Ignore List',
      description:
        'Comma delimited List of domains and IPs that you never want to send to Flashpoint',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'domainBlocklistRegex',
      name: 'Ignore Domain Regex',
      description: 'Domains that match the given regex will not be looked up.',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'ipBlocklistRegex',
      name: 'Ignore IP Regex',
      description: 'IPs that match the given regex will not be looked up.',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    }
  ]
};