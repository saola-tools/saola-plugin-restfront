"use strict";

const path = require("path");

module.exports = {
  plugins: {
    pluginRestfetch: {
      throughputQuota: 1,
      mappingStore: {
        "restfetch-example": path.join(__dirname, "../lib/mappings/restfetch/")
      },
      mappings: {
        "restfetch-example/mockser": {
          enabled: true
        }
      }
    },
    pluginRestfront: {
      mappingStore: {
        "restfetch-example": path.join(__dirname, "../lib/mappings/restfront/mockser")
      }
    },
  }
};
