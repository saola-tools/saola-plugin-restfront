"use strict";

const path = require("path");

module.exports = {
  plugins: {
    pluginRestfront: {
      mappingStore: {
        "example-samples": path.join(__dirname, "../lib/mappings/req-to-rpc-samples")
      }
    }
  }
};
