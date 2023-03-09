"use strict";

const path = require("path");
const contextPath = "/example";
const apiPath = "rest";

module.exports = {
  plugins: {
    pluginRestfront: {
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
    pluginLogtracer: {
      portlets: {
        default: {},
        formula: {
          tracingPaths: [ path.join(contextPath, apiPath) ],
          tracingBoundaryEnabled: true
        }
      }
    },
    pluginWebweaver: {
      portlets: {
        default: {},
        formula: {}
      }
    },
    pluginWebserver: {
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
