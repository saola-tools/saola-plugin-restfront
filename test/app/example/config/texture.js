"use strict";

module.exports = {
  application: {
    services: {
      example: {
        methods: {
          fibonacci: {
          }
        }
      }
    }
  },
  plugins: {
    pluginRestfront: {
      services: {
        handler: {
          methods: {
            lookupMethod: {
              logging: {
                onRequest: {
                  extractInfo: function(argumentsList) {
                    return {serviceName: argumentsList[0], methodName: argumentsList[1]};
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
