'use strict';

var path = require('path');
var contextPath = '/restfront';
var apiPath = 'rest';

module.exports = {
  plugins: {
    appRestfront: {
      contextPath: contextPath,
      apiPath: apiPath,
      mappingStore: {
        "example-mappings": path.join(__dirname, '../lib/mappings/req-to-rpc')
      },
      static: {
        'apidoc': path.join(__dirname, '../public/apidoc'),
        'assets': path.join(__dirname, '../public/assets')
      }
    },
    appTracelog: {
      tracingPaths: [ path.join(contextPath, apiPath) ],
      tracingBoundaryEnabled: true
    }
  }
};
