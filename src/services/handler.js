"use strict";

const Devebot = require("@saola/core");
const Promise = Devebot.require("bluebird");
const chores = Devebot.require("chores");
const lodash = Devebot.require("lodash");
const Validator = require("schema-validator");
const path = require("path");

const { PortletMixiner } = require("@saola/plugin-webserver").require("portlet");
const { isPureObject, parseUserAgent } = require("../utils");

function Handler (params = {}) {
  const { packageName, loggingFactory, configPortletifier, tracelogService, webweaverService } = params;
  const { sandboxRegistry, errorManager, mappingLoader, schemaValidator } = params;

  PortletMixiner.call(this, {
    portletBaseConfig: configPortletifier.getPortletBaseConfig(),
    portletDescriptors: configPortletifier.getPortletDescriptors(),
    portletReferenceHolders: { webweaverService, tracelogService },
    portletArguments: {
      packageName, loggingFactory,
      sandboxRegistry, errorManager, mappingLoader, schemaValidator
    },
    PortletConstructor: Portlet,
  });

  // @deprecated
  this.validator = function (express) {
    return this.hasPortlet() && this.getPortlet().validator(express) || undefined;
  };

  // @deprecated
  this.buildRestRouter = function (express) {
    return this.hasPortlet() && this.getPortlet().buildRestRouter(express) || undefined;
  };
}

Object.assign(Handler.prototype, PortletMixiner.prototype);

Handler.referenceHash = {
  configPortletifier: "portletifier",
  errorManager: "@saola/plugin-errorlist/manager",
  mappingLoader: "@saola/core/mappingLoader",
  sandboxRegistry: "@saola/core/sandboxRegistry",
  schemaValidator: "@saola/core/schemaValidator",
  tracelogService: "@saola/plugin-logtracer/tracelogService",
  webweaverService: "@saola/plugin-webweaver/webweaverService"
};

function Portlet (params = {}) {
  const { packageName, loggingFactory, portletName, portletConfig } = params;
  const { sandboxRegistry, errorManager, mappingLoader, schemaValidator, tracelogService } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName);

  L && L.has("silly") && L.log("silly", T && T.add({ blockRef, portletName }).toMessage({
    tags: [ blockRef, portletName ],
    text: "The Portlet[${blockRef}][${portletName}] is available"
  }));

  const mappingHash = sanitizeMappings(mappingLoader.loadMappings(portletConfig.mappingStore));

  const mappings = joinMappings(mappingHash);

  const swaggerBuilder = sandboxRegistry.lookupService("app-apispec/swaggerBuilder") ||
      sandboxRegistry.lookupService("app-restguide/swaggerBuilder");

  if (swaggerBuilder) {
    lodash.forOwn(mappingHash, function(mappingBundle, name) {
      if (mappingBundle.apiDocs) {
        swaggerBuilder.addApiEntries(mappingBundle.apiDocs);
      }
    });
  }

  const serviceResolver = portletConfig.serviceResolver || "app-opmaster/commander";
  const serviceSelector = chores.newServiceSelector({ serviceResolver, sandboxRegistry });

  const errorBuilder = errorManager.register(packageName, {
    errorCodes: portletConfig.errorCodes
  });

  const CTX = {
    L, T, portletName, portletConfig,
    errorManager, errorBuilder, serviceSelector, schemaValidator, tracelogService
  };

  this.validator = function (express) {
    const router = express.Router();
    lodash.forEach(mappings, function (mapping) {
      if (mapping.validatorSchema) {
        router.all(mapping.path, function (req, res, next) {
          if (!isMethodIncluded(mapping.method, req.method)) {
            return next();
          }
          const requestId = tracelogService.getRequestId(req);
          const reqTR = T.branch({ key: "requestId", value: requestId });
          L && L.has("info") && L.log("info", reqTR && reqTR.add({
            mapPath: mapping.path,
            mapMethod: mapping.method,
            url: req.url,
            method: req.method,
            validatorSchema: mapping.validatorSchema
          }).toMessage({
            text: "Validate for Req[${requestId}] from [${method}]${url} with schema [${validatorSchema}]"
          }, "direct"));
          let validator = new Validator(mapping.validatorSchema);
          let check = validator.check(req.body);
          if (check._error) {
            check.isError = check._error;
            delete check._error;
            res.status(mapping.validatorSchema.statusCode || 400).send(check);
          } else {
            next();
          }
        });
      }
    });
    return router;
  };

  this.buildRestRouter = function (express) {
    const router = express.Router();
    lodash.forEach(mappings, function (mapping) {
      L && L.has("info") && L.log("info", T && T.add({
        mapPath: mapping.path,
        mapMethod: mapping.method
      }).toMessage({
        text: "Route[${mapMethod}][${mapPath}] is mapped"
      }));
      router.all(mapping.path, buildMiddlewareFromMapping(CTX, mapping));
    });
    return router;
  };
}

function joinMappings (mappingHash, mappings = []) {
  lodash.forOwn(mappingHash, function(mappingBundle, mappingName) {
    const list = mappingBundle.apiMaps;
    if (lodash.isArray(list)) {
      mappings.push.apply(mappings, lodash.map(list, function(item) {
        item.errorSource = item.errorSource || mappingName;
        return item;
      }));
    }
  });
  return mappings;
}

function sanitizeMappings (mappingHash, newMappings = {}) {
  lodash.forOwn(mappingHash, function(mappingList, name) {
    mappingList = mappingList || {};
    const apiPath = mappingList["apiPath"];
    newMappings[name] = newMappings[name] || {};
    // prefix the paths of middlewares by apiPath
    let list = mappingList.apiMaps || mappingList.apimaps || mappingList;
    if (lodash.isArray(list)) {
      if (lodash.isString(apiPath) && !lodash.isEmpty(apiPath)) {
        list = lodash.map(list, function(item) {
          if (lodash.isString(item.path)) {
            item.path = path.join(apiPath, item.path);
          }
          if (lodash.isArray(item.path)) {
            item.path = lodash.map(item.path, function(subpath) {
              return path.join(apiPath, subpath);
            });
          }
          return item;
        });
      }
      newMappings[name].apiMaps = upgradeMappings(list);
    }
    // prefix the paths of swagger entries by apiPath
    let swagger = mappingList.apiDocs || mappingList.swagger;
    if (swagger && swagger.paths && lodash.isObject(swagger.paths)) {
      if (lodash.isString(apiPath) && !lodash.isEmpty(apiPath)) {
        swagger.paths = lodash.mapKeys(swagger.paths, function(obj, key) {
          return path.join(apiPath, key);
        });
      }
    }
    newMappings[name].apiDocs = swagger;
  });
  return newMappings;
}

function upgradeMappings (mappings = []) {
  return lodash.map(mappings, upgradeMapping);
}

function upgradeMapping (mapping = {}) {
  // input ~ transformRequest
  mapping.input = mapping.input || {};
  if (!lodash.isFunction(mapping.input.preValidator)) {
    delete mapping.input.preValidator;
  }
  if (!lodash.isFunction(mapping.input.transform)) {
    delete mapping.input.transform;
    if (lodash.isFunction(mapping.transformRequest)) {
      mapping.input.transform = mapping.transformRequest;
      delete mapping.transformRequest;
    }
  }
  if (!lodash.isFunction(mapping.input.postValidator)) {
    delete mapping.input.postValidator;
  }
  mapping.input.mutate = mapping.input.mutate || {};
  // inlet - manual processing
  mapping.inlet = mapping.inlet || {};
  if (!lodash.isFunction(mapping.inlet.process)) {
    delete mapping.inlet.process;
  }
  // output ~ transformResponse
  mapping.output = mapping.output || {};
  if (!lodash.isFunction(mapping.output.transform)) {
    delete mapping.output.transform;
    if (lodash.isFunction(mapping.transformResponse)) {
      mapping.output.transform = mapping.transformResponse;
      delete mapping.transformResponse;
    }
  }
  mapping.output.mutate = mapping.output.mutate || {};
  // error ~ transformError
  mapping.error = mapping.error || {};
  if (!lodash.isFunction(mapping.error.transform)) {
    delete mapping.error.transform;
    if (lodash.isFunction(mapping.transformError)) {
      mapping.error.transform = mapping.transformError;
      delete mapping.transformError;
    }
  }
  mapping.error.mutate = mapping.error.mutate || {};
  // return the mapping
  return mapping;
}

function isMethodIncluded (methods, reqMethod) {
  if (reqMethod && lodash.isString(reqMethod)) {
    reqMethod = reqMethod.toUpperCase();
    if (methods) {
      if (lodash.isString(methods)) {
        return reqMethod === methods.toUpperCase();
      }
      if (lodash.isArray(methods)) {
        return lodash.some(methods, function(item) {
          return item && (reqMethod === item.toUpperCase());
        });
      }
    }
  }
  return false;
}

function buildMiddlewareFromMapping (context, mapping) {
  context = context || {};

  const { portletName, portletConfig } = context;
  const { L, T, errorManager, errorBuilder, serviceSelector, schemaValidator, tracelogService, verbose } = context;

  const timeout = mapping.timeout || portletConfig.defaultTimeout;

  const ref = serviceSelector.lookupMethod(mapping.serviceName, mapping.methodName);
  const refMethod = ref && ref.method;

  const requestOptions = lodash.merge({}, portletConfig.requestOptions, mapping.requestOptions);
  const responseOptions = lodash.merge({}, portletConfig.responseOptions, mapping.responseOptions);

  const mappingErrorBuilder = errorManager.getErrorBuilder(mapping.errorSource) || errorBuilder;

  const BusinessError = errorManager.BusinessError;

  const services = { logger: L, tracer: T, BusinessError, errorBuilder: mappingErrorBuilder, schemaValidator };

  return function (req, res, next) {
    if (!isMethodIncluded(mapping.method, req.method)) {
      return wrapNext(next, verbose);
    }
    const requestId = tracelogService.getRequestId(req);
    const reqTR = T.branch({ key: "requestId", value: requestId });
    L && L.has("info") && L.log("info", reqTR && reqTR.add({
      mapPath: mapping.path,
      mapMethod: mapping.method,
      url: req.url,
      method: req.method
    }).toMessage({
      text: "Req[${requestId}] from [${method}]${url}"
    }, "direct"));

    if (!lodash.isFunction(refMethod)) {
      return wrapNext(next, verbose);
    }

    let promize = Promise.resolve();

    const failedReqOpts = [];
    const reqOpts = extractRequestOptions(req, requestOptions, {
      userAgentEnabled: portletConfig.userAgentEnabled,
      extensions: { requestId, timeout }
    }, failedReqOpts);

    if (failedReqOpts.length > 0) {
      promize = promize.then(function() {
        return Promise.reject(errorBuilder.newError("RequestOptionNotFound", {
          payload: {
            requestOptions: failedReqOpts
          },
          language: reqOpts.languageCode
        }));
      });
    }

    if (mapping.input && mapping.input.enabled !== false && mapping.input.preValidator) {
      promize = promize.then(function () {
        return applyValidator(mapping.input.preValidator, {
          errorBuilder: errorBuilder,
          errorName: "RequestPreValidationError"
        }, req, reqOpts, services);
      });
    }

    if (mapping.input && mapping.input.enabled !== false && mapping.input.transform) {
      promize = promize.then(function () {
        return mapping.input.transform(req, reqOpts, services);
      });
    } else {
      promize = promize.then(function () {
        return req.body;
      });
    }

    if (mapping.input && mapping.input.enabled !== false && mapping.input.mutate && mapping.input.mutate.rename) {
      promize = promize.then(function (reqData) {
        return mutateRenameFields(reqData, mapping.input.mutate.rename);
      });
    }

    if (mapping.input && mapping.input.enabled !== false && mapping.input.postValidator) {
      promize = promize.then(function (reqData) {
        return applyValidator(mapping.input.postValidator, {
          errorBuilder: errorBuilder,
          errorName: "RequestPostValidationError"
        }, reqData, reqOpts, services);
      });
    }

    if (mapping.inlet && mapping.inlet.process) {
      promize = promize.then(function (reqData) {
        return mapping.inlet.process(refMethod, res, reqData, reqOpts, services);
      });
    } else {
      promize = promize.then(function (reqData) {
        return refMethod(reqData, reqOpts);
      });

      // transform the result
      if (mapping.output && mapping.output.enabled !== false && mapping.output.transform) {
        promize = promize.then(function (result) {
          return mapping.output.transform(result, req, reqOpts, services);
        }).then(function (packet) {
          if (lodash.isEmpty(packet) || !("body" in packet)) {
            packet = { body: packet };
          }
          return addDefaultResponseHeaders(packet, responseOptions);
        });
      } else {
        promize = promize.then(function (result) {
          let packet = { body: result };
          return addDefaultResponseHeaders(packet, responseOptions);
        });
      }

      // rename the fields
      if (mapping.output && mapping.output.enabled !== false && mapping.output.mutate && mapping.output.mutate.rename) {
        promize = promize.then(function (packet) {
          return mutateRenameFields(packet, mapping.output.mutate.rename);
        });
      }

      // except the fields
      if (mapping.output && mapping.output.enabled !== false && mapping.output.mutate && mapping.output.mutate.except) {
        promize = promize.then(function (packet) {
          return mutateExcludeFields(packet, mapping.output.mutate.except);
        });
      }

      if (mapping.output && mapping.output.enabled !== false && mapping.output.sanitize) {
        promize = promize.then(function (packet) {
          if (packet && isPureObject(packet.body)) {
            packet.body = mapping.output.sanitize(packet.body, req, reqOpts, services);
          }
          return packet;
        });
      }

      // render the packet
      promize = promize.then(function (packet) {
        renderPacketToResponse(packet, res);
        //
        L && L.has("trace") && L.log("trace", reqTR && reqTR.toMessage({
          text: "Req[${requestId}] is completed"
        }));
        //
        return packet;
      });
    }

    // set the timeout at the end of the processing flow (before 'catch' blocks)
    if (timeout && timeout > 0) {
      promize = promize.timeout(timeout);
    }

    promize = promize.catch(Promise.TimeoutError, function() {
      L && L.has("error") && L.log("error", reqTR && reqTR.add({
        timeout: reqOpts.timeout
      }).toMessage({
        text: "Req[${requestId}] has timeout after ${timeout} seconds"
      }));
      return Promise.reject(errorBuilder.newError("RequestTimeoutOnServer", {
        payload: {
          timeout: reqOpts.timeout
        },
        language: reqOpts.languageCode
      }));
    });

    promize = promize.catch(function(failed) {
      let packet = transformErrorToPacket(failed, mapping, req, reqOpts, services, responseOptions);
      // rename the fields
      if (mapping.error && mapping.error.enabled !== false && mapping.error.mutate && mapping.error.mutate.rename) {
        packet = mutateRenameFields(packet, mapping.error.mutate.rename);
      }
      // Render the packet
      packet.statusCode = packet.statusCode || 500;
      renderPacketToResponse(packet, res);
      L && L.has("error") && L.log("error", reqTR && reqTR.add(packet).toMessage({
        text: "Req[${requestId}] has failed, status[${statusCode}], headers: ${headers}, body: ${body}"
      }));
      //
      return Promise.reject(failed);
    });

    promize.finally(function () {
      L && L.has("silly") && L.log("silly", reqTR && reqTR.toMessage({
        text: "Req[${requestId}] end"
      }));
    });

    return verbose ? promize : undefined;
  };
}

function wrapNext (next, verbose) {
  return verbose ? Promise.resolve().then(next) : next();
}

function mutateRenameFields (data, nameMappings) {
  return chores.renameJsonFields(data, nameMappings);
}

function mutateExcludeFields (data, excludedFields) {
  if (data && isPureObject(data.body)) {
    data.body = lodash.omit(data.body, excludedFields);
  }
  return data;
}

function applyValidator (validator, defaultRef, reqData, reqOpts, services) {
  return Promise.resolve(validator(reqData, reqOpts, services)).then(function (result) {
    if (!isPureObject(result)) {
      result = { valid: result };
    }
    if (result.valid === false) {
      if (result.errorName && services.errorBuilder) {
        return Promise.reject(services.errorBuilder.newError(result.errorName, {
          payload: {
            errors: result.errors
          }
        }));
      }
      return Promise.reject(defaultRef.errorBuilder.newError(defaultRef.errorName, {
        payload: {
          errors: result.errors
        }
      }));
    }
    return reqData;
  });
}

function addDefaultResponseHeaders (packet, responseOptions) {
  packet.headers = packet.headers || {};
  const headerName = responseOptions && responseOptions.returnCode && responseOptions.returnCode.headerName;
  if ((typeof headerName === "string") && !(headerName in packet.headers)) {
    packet.headers[headerName] = 0;
  }
  return packet;
}

function extractErrorResponseHeaders (error, responseOptions = {}, packet = {}) {
  packet.headers = packet.headers || {};
  lodash.forOwn(responseOptions, function(resOpt = {}, optionName) {
    if (optionName in error && lodash.isString(resOpt.headerName)) {
      packet.headers[resOpt.headerName] = error[optionName];
    }
  });
  return packet;
}

function transformErrorObject (error, responseOptions) {
  // statusCode, headers, body
  let packet = {
    statusCode: error.statusCode || 500,
    headers: {},
    body: {
      name: error.name,
      message: error.message
    }
  };
  // payload
  if (lodash.isObject(error.payload)) {
    packet.body.payload = error.payload;
  }
  // Error.stack
  if (chores.isDevelopmentMode()) {
    packet.body.stack = lodash.split(error.stack, "\n");
  }
  // responseOptions keys: X-Package-Ref & X-Return-Code
  packet = extractErrorResponseHeaders(error, responseOptions, packet);
  //
  return packet;
}

const ERROR_FIELDS = [ "statusCode", "headers", "body" ];

function transformScalarError (error, responseOptions = {}, packet = {}) {
  if (error === null) {
    packet.body = {
      type: "null",
      message: "Error is null"
    };
  } else if (lodash.isString(error)) {
    packet.body = {
      type: "string",
      message: error
    };
  } else if (lodash.isArray(error)) {
    packet.body = {
      type: "array",
      payload: error
    };
  } else if (lodash.isObject(error)) {
    lodash.assign(packet, lodash.pick(error, ERROR_FIELDS));
    if (lodash.isNil(packet.body)) {
      packet.body = lodash.omit(error, ERROR_FIELDS.concat(lodash.keys(responseOptions)));
    }
    packet = extractErrorResponseHeaders(error, responseOptions, packet);
  } else {
    packet.body = {
      type: (typeof error),
      message: "Error: " + error,
      payload: error
    };
  }
  packet.statusCode = packet.statusCode || 500;
  packet.headers = packet.headers || {};
  const returnCodeName = lodash.get(responseOptions, "returnCode.headerName", "X-Return-Code");
  if (!(returnCodeName in packet.headers)) {
    packet.headers[returnCodeName] = -1;
  }
  return packet;
}

function extractRequestOptions (req, requestOptions, opts = {}, errors) {
  const result = {};

  for (const optionKey in requestOptions) {
    let requestOption = requestOptions[optionKey];
    if (lodash.isString(requestOption)) {
      requestOption = { headerName: requestOption };
    }
    if (lodash.isEmpty(requestOption.headerName)) {
      continue;
    }
    const optionName = requestOption.optionName || optionKey;
    const optionValue = req.get(requestOption.headerName);
    if (requestOption.required && lodash.isNil(optionValue)) {
      if (lodash.isArray(errors)) {
        errors.push(optionKey);
      }
    }
    result[optionName] = optionValue;
  }

  if (opts.userAgentEnabled) {
    result.userAgent = parseUserAgent(req.get("User-Agent"));
  }

  for (const key in opts.extensions) {
    if (opts.extensions[key] !== undefined) {
      result[key] = opts.extensions[key];
    }
  }

  return result;
}

//-------------------------------------------------------------------------------------------------

function renderPacketToResponse_Standard (packet = {}, res) {
  if (lodash.isObject(packet.headers)) {
    lodash.forOwn(packet.headers, function (value, key) {
      res.set(key, value);
    });
  }
  res.status(packet.statusCode || 200);
  if (lodash.isNil(packet.body)) {
    res.end();
  } else {
    if (lodash.isString(packet.body)) {
      res.send(packet.body);
    } else {
      res.json(packet.body);
    }
  }
}

function renderPacketToResponse_Optimized (packet = {}, res) {
  // affected with a Pure JSON object
  if (isPureObject(packet.headers)) {
    for (const key in packet.headers) {
      res.set(key, packet.headers[key]);
    }
  }
  res.status(packet.statusCode || 200);
  if (packet.body === undefined || packet.body === null) {
    res.end();
  } else {
    if (typeof packet.body === "string") {
      res.send(packet.body);
    } else {
      res.json(packet.body);
    }
  }
}

let renderPacketToResponse = renderPacketToResponse_Standard;

if (chores.isUpgradeSupported("optimization-mode")) {
  renderPacketToResponse = renderPacketToResponse_Optimized;
}

//-------------------------------------------------------------------------------------------------

function transformScalarOrObjectError (failed, responseOptions, packet) {
  if (failed instanceof Error) {
    packet = transformErrorObject(failed, responseOptions);
  } else {
    packet = transformScalarError(failed, responseOptions, packet);
  }
  return packet;
}

function transformErrorToPacketLegacy (failed, mapping, req, reqOpts, services, responseOptions) {
  let packet = {};
  // transform error object to packet
  if (mapping.error && mapping.error.enabled !== false && mapping.error.transform) {
    packet = mapping.error.transform(failed, req, reqOpts, services);
    packet = packet || {};
    packet.body = packet.body || {
      message: "mapping.error.transform() output don't have body field"
    };
  } else {
    packet = transformScalarOrObjectError(failed, responseOptions, packet);
  }
  //
  return packet;
}

function transformErrorToPacketModern (failed, mapping, req, reqOpts, services, responseOptions) {
  let packet = {};
  // apply the explicit transform function
  if (mapping.error && mapping.error.enabled !== false && mapping.error.transform) {
    failed = mapping.error.transform(failed, req, reqOpts, services);
  }
  // transform error object to packet
  packet = transformScalarOrObjectError(failed, responseOptions, packet);
  //
  return packet;
}

let transformErrorToPacket = transformErrorToPacketModern;

if (chores.isUpgradeSupported("saola-plugin-restfront-legacy-error-to-response")) {
  transformErrorToPacket = transformErrorToPacketLegacy;
}

module.exports = Handler;
