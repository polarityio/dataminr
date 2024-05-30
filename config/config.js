module.exports = {
  name: 'Dataminr',
  acronym: 'DM',
  description: 'Search Dataminr by all entities to get related Alerts',
  entityTypes: ['*'],
  customTypes: [
    {
      key: 'allText',
      regex: '\S[\s\S]{2,256}\S'
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
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'clientSecret',
      name: 'Client Secret',
      description: 'Your Client Secret Credential',
      default: '',
      type: 'password',
      userCanEdit: true,
      adminOnly: false
    }
  ]
};
