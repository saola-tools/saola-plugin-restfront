"use strict";

const path = require("path");
const contextPath = "/restfront";
const apiPath = "rest";

module.exports = {
  plugins: {
    appRestfront: {
      portlets: {
        default: {},
        formula: {
          contextPath: contextPath,
          apiPath: apiPath,
          mappingStore: {
            "formula-mappings": path.join(__dirname, "../lib/mappings/req-to-formula")
          },
        }
      }
    },
    appTracelog: {
      portlets: {
        default: {},
        formula: {
          tracingPaths: [ path.join(contextPath, apiPath) ],
          tracingBoundaryEnabled: true
        }
      }
    },
    appWebweaver: {
      portlets: {
        default: {},
        formula: {}
      }
    },
    appWebserver: {
      portlets: {
        default: {},
        formula: {
          host: "0.0.0.0",
          port: 9797
        }
      }
    }
  }
};
