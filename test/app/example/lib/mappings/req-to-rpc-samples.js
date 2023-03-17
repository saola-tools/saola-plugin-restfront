"use strict";

const FRWK = require("@saola/core");
const lodash = FRWK.require("lodash");

const mappings = {
  apiPath: "/sub",
  apiMaps: [
    {
      path: "/:apiVersion/fibonacci/calc/:number",
      sample: new (function () {
        const scenarios = {
          default: {
            request: {
              method: "GET",
              params: { apiVersion: "v1", number: 47 },
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": "54983DAF-1CF7-4599-975A-9F91049F9708",
                "X-Environment": "dev",
              },
              query: {
                tags: ["fibonacci", "calc"]
              },
            },
            response: {
              statusCode: 200
            }
          }
        };
        //
        this.getNames = function() {
          return lodash.keys(scenarios);
        };
        //
        this.getScenario = function(name) {
          return lodash.get(scenarios, name, scenarios.default);
        };
      }),
    }
  ]
};

module.exports = mappings;
