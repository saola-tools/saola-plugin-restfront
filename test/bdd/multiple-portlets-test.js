"use strict";

const axios = require("axios");
const { assert } = require("liberica");

const FRWK = require("@saola/core");
const Promise = FRWK.require("bluebird");
const chores = FRWK.require("chores");
const lodash = FRWK.require("lodash");

const path = require("path");
const freshy = require("freshy");

function requireFresh (moduleName, basePath) {
  return freshy.reload(path.join(basePath || __dirname, moduleName));
}

describe("bdd: @saola/plugin-restfront", function() {
  before(function() {
    chores.setEnvironments({
      SAOLA_SANDBOX: "new-mappings,portlets",
      SAOLA_UPGRADE_ENABLED: "manifest-bypassed",
      SAOLA_FORCING_SILENT: "framework,webserver",
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
  describe("multiple-portlets", function() {
    const example = requireFresh("../app/example", __dirname);
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
            url: "http://localhost:7979/example/rest/sub/v2/fibonacci/calc/47",
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
            url: "http://localhost:9797/example/rest/sub/v2/triangle-area/12/5",
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
