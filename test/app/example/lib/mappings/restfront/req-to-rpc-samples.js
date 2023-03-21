"use strict";

const FRWK = require("@saola/core");
const lodash = FRWK.require("lodash");

const { assert } = require("liberica");

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
              contentType: "json",
              contains: {
                statusCode: 200,
                statusText: "OK",
                headers: {
                  "Content-Type": "application/json",
                },
                body: {
                  "value": 2971215073,
                  "step": 47,
                  "number": 47
                }
              },
              checker: function(output, response, request) {
                assert.deepEqual(output.body, {
                  "value": 2971215073,
                  "step": 47,
                  "number": 47
                });
              }
            }
          },
          InvalidInputNumber: {
            request: {
              method: "GET",
              params: { apiVersion: "v1", number: "abc" },
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": "54983DAF-1CF7-4599-975A-9F91049F9708",
                "X-Environment": "dev",
              },
            },
            response: {
              contains: {
                statusCode: 400,
                statusText: "Bad Request",
                headers: {
                  "content-type": "application/json",
                  "x-request-id": "54983DAF-1CF7-4599-975A-9F91049F9708",
                  "x-return-code": "1009",
                },
                body: {
                  name: 'InvalidInputNumber',
                  message: 'Invalid input number'
                }
              },
            }
          },
          MaximumExceeding: {
            request: {
              method: "GET",
              params: { apiVersion: "v1", number: 51 },
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": "54983DAF-1CF7-4599-975A-9F91049F9708",
                "X-Environment": "dev",
              },
            },
            response: {
              contains: {
                statusCode: 400,
                statusText: "Bad Request",
                headers: {
                  "content-type": "application/json",
                  "x-request-id": "54983DAF-1CF7-4599-975A-9F91049F9708",
                  "x-return-code": "1002",
                },
                body: {
                  name: 'MaximumExceeding',
                  message: 'Maximum input number exceeded',
                  payload: {
                    errors: [
                      "Maximum input number exceeded"
                    ]
                  }
                }
              },
              checker: function(output, mockout) {
              },
            }
          },
        };
        //
        this.getNames = function() {
          return lodash.keys(scenarios);
        };
        //
        this.getScenario = function(name) {
          return lodash.get(scenarios, name);
        };
      }),
    }
  ]
};

module.exports = mappings;
