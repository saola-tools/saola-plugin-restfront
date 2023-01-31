"use strict";

module.exports = {
  plugins: {
    pluginRestfront: {
      mappingStore: require("path").join(__dirname, "../lib/mappings/req-to-rpc-deprecated")
    }
  }
};
