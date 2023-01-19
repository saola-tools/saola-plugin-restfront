"use strict";

const axios = require("axios");
const { assert } = require("liberica");

const Devebot = require("devebot");
const Promise = Devebot.require("bluebird");
const chores = Devebot.require("chores");
const lodash = Devebot.require("lodash");

const path = require("path");
const freshy = require("freshy");

function requireFresh (moduleName, basePath) {
  const modulePath = path.join(basePath, moduleName);
  freshy.unload(modulePath);
  return require(modulePath);
}

describe("app-restfront", function() {
  describe("multiple-portlets", function() {
    const example = requireFresh("../app/example", __dirname);
    //
    before(function() {
      chores.setEnvironments({
        DEVEBOT_SANDBOX: "new-mappings,portlets",
        DEVEBOT_UPGRADE_ENABLED: "manifest-bypassed",
        DEVEBOT_FORCING_SILENT: "devebot,webserver",
        LOGOLITE_FULL_LOG_MODE: "false",
        LOGOLITE_ALWAYS_ENABLED: "all",
        LOGOLITE_ALWAYS_MUTED: "all"
      });
    });
    //
    after(function() {
      chores.clearCache();
    });
    //
    it("Request and response smoothly", function() {
      const expected = [
        {
          status: 200,
          data: {
            "value": 2971215073,
            "step": 47,
            "number": "47"
          }
        },
        {
          "status": 200,
          "data": {
            "area": 30
          }
        },
      ];
      //
      return example.server.start().then(function() {
        return Promise.all([
          axios.request({
            url: "http://localhost:7979/restfront/rest/sub/v2/fibonacci/calc/47",
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": "2219b258-ed3c-4a4b-8242-d9b62e9a576d",
              "X-Schema-Version": "1.2.0"
            },
            data: undefined,
            responseType: "json",
          }),
          axios.request({
            url: "http://localhost:9797/restfront/rest/sub/v2/triangle-area/12/5",
            method: "GET",
            headers: {"Content-Type": "application/json"},
            data: undefined,
            responseType: "json",
          }),
        ]);
      })
      .then(function(resps) {
        const output = lodash.map(resps, function(resp) {
          return {
            status: resp.status,
            data: resp.data
          };
        });
        false && console.log(JSON.stringify(output, null, 2));
        assert.sameDeepMembers(output, expected);
      })
      .catch(function(err) {
        console.log(err);
        assert.fail("This testcase must complete successfully");
      })
      .finally(function() {
        return example.server.stop();
      });
    });
  });
});
