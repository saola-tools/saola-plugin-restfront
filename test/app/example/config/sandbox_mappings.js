"use strict";

const path = require("path");

module.exports = {
  plugins: {
    pluginRestfront: {
      mappingStore: {
        "example-mappings": path.join(__dirname, "../lib/mappings/restfront/req-to-rpc")
      }
    }
  }
};
