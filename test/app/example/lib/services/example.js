"use strict";

const FRWK = require("@saola/core");
const Promise = FRWK.require("bluebird");
const chores = FRWK.require("chores");
const lodash = FRWK.require("lodash");
const Fibonacci = require("../utils/fibonacci");

const Service = function(params = {}) {
  const { loggingFactory, packageName, sandboxConfig, errorManager } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName);

  errorManager.register(packageName, {
    errorCodes: sandboxConfig.errorCodes
  });

  errorManager.register("otherErrorSource", {
    errorCodes: sandboxConfig.otherErrorSource
  });

  const errorBuilder = errorManager.getErrorBuilder(packageName);

  this.fibonacci = function(data, opts) {
    opts = opts || {};
    const reqTr = T.branch({ key: "requestId", value: opts.requestId || T.getLogID() });
    L && L.has("debug") && L.log("debug", reqTr.add({ data: data }).toMessage({
      tags: [ blockRef, "fibonacci" ],
      text: " - fibonacci[${requestId}] is invoked with parameters: ${data}"
    }));
    data.number = parseInt(data.number);
    if (lodash.isNaN(data.number) || data.number < 0 || data.number > 50) {
      return Promise.reject(errorBuilder.newError("InvalidInputNumber", {
        input: data,
        message: "invalid input number"
      }));
    }
    const fibonacci = new Fibonacci(data);
    const result = fibonacci.finish();
    result.actionId = data.actionId;
    L && L.has("debug") && L.log("debug", reqTr.add({ result: result }).toMessage({
      tags: [ blockRef, "fibonacci" ],
      text: " - fibonacci[${requestId}] result: ${result}"
    }));
    if (data.delay && data.delay > 0) {
      return Promise.resolve(result).delay(data.delay);
    }
    return result;
  };
};

Service.referenceHash = {
  errorManager: "@saola/plugin-errorlist/manager"
};

module.exports = Service;
