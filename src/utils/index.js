"use strict";

const uaParser = require("ua-parser-js");
const FRWK = require("@saola/core");
const lodash = FRWK.require("lodash");

function isPureObject (o) {
  return o && (typeof o === "object") && !Array.isArray(o);
}

function filterMethodResult ({ clone, basepath, omit, pick } = {}, next) {
  function callNext (next, resp, req, reqOpts) {
    if (lodash.isFunction(next)) {
      return next(resp, req, reqOpts);
    }
    return resp;
  }
  return function (result, req, reqOpts) {
    if (!isPureObject(result)) {
      return callNext(next, result, req, reqOpts);
    }
    //
    let resp = clone ? lodash.cloneDeep(result) : result;
    //
    const selected = lodash.isString(basepath) || lodash.isArray(basepath);
    let target = selected ? lodash.get(resp, basepath) : resp;
    //
    if (lodash.isArray(pick)) {
      target = lodash.pick(target, pick);
    }
    if (lodash.isArray(omit)) {
      target = lodash.omit(target, omit);
    }
    //
    resp = selected ? lodash.set(resp, basepath, target) : target;
    //
    return callNext(next, resp, req, reqOpts);
  };
}

function parseUserAgent (userAgentString) {
  if (!userAgentString) {
    return {};
  }
  return uaParser(userAgentString);
}

function assertProperty (obj, propName, defaultValue = {}) {
  if (!lodash.has(obj, propName)) {
    lodash.set(obj, propName, defaultValue);
  }
  return lodash.get(obj, propName);
}

module.exports = {
  isPureObject,
  filterMethodResult,
  parseUserAgent,
  assertProperty,
};
