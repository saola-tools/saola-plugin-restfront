"use strict";

module.exports = {
  plugins: {
    pluginRestfront: {
      mappingStore: require("path").join(__dirname, "../lib/mappings/restfront/req-to-rpc-deprecated")
    }
  }
};
