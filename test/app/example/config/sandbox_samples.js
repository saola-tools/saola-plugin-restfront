"use strict";

const path = require("path");

module.exports = {
  plugins: {
    pluginRestfront: {
      mappingStore: {
        "example-samples": path.join(__dirname, "../lib/mappings/restfront/req-to-rpc-samples")
      }
    }
  }
};
