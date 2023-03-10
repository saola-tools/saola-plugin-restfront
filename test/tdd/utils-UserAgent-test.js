"use strict";

const assert = require("liberica").assert;

const { parseUserAgent } = require("../../lib/utils");

describe("tdd: utils", function() {
  describe("parseUserAgent()", function() {

    it("return an empty object if the UserAgent String is undefined", function() {
      const ua = parseUserAgent();
      assert.deepEqual(ua, {});
    });

    it("return an empty object if the UserAgent String is empty", function() {
      const ua = parseUserAgent("");
      assert.deepEqual(ua, {});
    });

    it("return a plain object if the user-agent string is provided", function() {
      const uaStr = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36";
      const ua = parseUserAgent(uaStr);
      //
      assert.property(ua, "ua");
      assert.propertyVal(ua, "ua", uaStr);
      //
      assert.property(ua, "browser");
      assert.deepEqual(ua.browser, { name: "Chrome", version: "107.0.0.0", major: "107" });
    });
  });
});
