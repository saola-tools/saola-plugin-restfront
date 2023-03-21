"use strict";

const FRWK = require("@saola/core");
const lodash = FRWK.require("lodash");
const chores = FRWK.require("chores");
const path = require("path");
const url = require("url");

const { PortletMixiner } = FRWK.require("portlet");

const { assertProperty } = require("../utils");
const { replaceParametersInUrl, renderCurlScript } = require("../utils/curl-toolkit");

function Service (params = {}) {
  const { packageName, loggingFactory, configPortletifier, restfrontHandler, webserverHandler } = params;

  PortletMixiner.call(this, {
    portletBaseConfig: configPortletifier.getPortletBaseConfig(),
    portletDescriptors: configPortletifier.getPortletDescriptors(),
    portletReferenceHolders: { restfrontHandler, webserverHandler },
    portletArguments: { packageName, loggingFactory },
    PortletConstructor: Portlet,
  });
}

Service.referenceHash = {
  configPortletifier: "portletifier",
  restfrontHandler: "handler",
  webserverHandler: "@saola/plugin-webserver/webserverHandler"
};

Object.assign(Service.prototype, PortletMixiner.prototype);

function Portlet (params = {}) {
  const { portletName, portletConfig } = params;
  const { packageName, loggingFactory, restfrontHandler, webserverHandler } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName);

  const urlObject = lodash.pick(webserverHandler, ["protocol", "hostname", "port"]);

  const contextPath = portletConfig.supportPath || "/_/restfront";
  const helpUrl = buildUrl(urlObject, contextPath);

  L && L.has("silly") && L.log("silly", T && T.add({ blockRef, portletName, contextPath }).toMessage({
    tags: [ blockRef ],
    text: "The Portlet[${blockRef}][${portletName}] is available for: '${contextPath}'"
  }));

  const generalPath = restfrontHandler.getGeneralPath();
  const mappingHash = restfrontHandler.getMappingHash();

  function transformMappings (generalPath, mappingHash, mappingDefs = {}) {
    lodash.forOwn(mappingHash, function(mappingBundle, mappingName) {
      lodash.forOwn(mappingBundle.apiMaps, function(item) {
        const itemPath = lodash.isArray(item.path) ? item.path : [ item.path ];
        lodash.forEach(itemPath, function(subPath) {
          subPath = path.join(generalPath, subPath);
          const mapping = assertProperty(mappingDefs, subPath);
          lodash.mergeWith(mapping, item, function(target, source, key) {
            if (lodash.isArray(target)) {
              return lodash.uniq(target.concat(source));
            }
            if (lodash.isArray(source) && key === "path") {
              return source;
            }
          });
          mapping.errorSource = mapping.errorSource || mappingName;
        });
      });
    });
    return mappingDefs;
  }

  const mappingDefs = transformMappings(generalPath, mappingHash);

  this.getPathPatterns = function() {
    return lodash.keys(mappingDefs);
  };

  this.getRenderer = function(pathPattern) {
    const descriptor = lodash.get(mappingDefs, pathPattern);
    if (!lodash.isObject(descriptor) || lodash.isEmpty(descriptor)) {
      return null;
    }
    return new Renderer({ urlObject, pathPattern, descriptor });
  };

  this.buildRestRouter = function (express) {
    const self = this;
    const router = express.Router();
    //
    router.all("/", function(req, res) {
      res.set("Content-Type", "application/json");
      res.status(200).send(JSON.stringify({
        originalUrl: req.originalUrl,
        mappingDefs: mappingDefs
      }, null, 2));
    });
    //
    router.get("/*", function(req, res) {
      //
      let format = ["curl", "json"].includes(req.query.format) ? req.query.format : "json";
      //
      let pathPattern = req.path;
      if (lodash.isString(pathPattern)) {
        pathPattern = pathPattern.replace(contextPath, "");
      }
      //
      const renderer = self.getRenderer(pathPattern);
      //
      if (!renderer) {
        if (format === "curl") {
          res.set("Content-Type", "text/plain");
          res.status(400).send(`echo 'The descriptor of [${pathPattern}] not found. See: ${helpUrl}'`);
        } else {
          res.set("Content-Type", "application/json");
          res.status(400).send(JSON.stringify({
            url: pathPattern,
            message: "The descriptor of the [url] not found",
            helpUrl: helpUrl,
          }));
        }
        return;
      }
      //
      if (!renderer.isSampleAvailable()) {
        if (format === "curl") {
          res.set("Content-Type", "text/plain");
          res.status(400).send(`echo 'The sample of [${pathPattern}] is not defined. See: ${helpUrl}'`);
        } else {
          res.set("Content-Type", "application/json");
          res.status(400).send(JSON.stringify({
            url: pathPattern,
            message: "The sample of the [url] is not defined",
            helpUrl: helpUrl,
          }));
        }
        return;
      }
      //
      const fetchParams = renderer.buildFetchParams();
      //
      if (format === "curl") {
        res.set("Content-Type", "text/plain");
        res.status(200).send(renderCurlScript(fetchParams.url, fetchParams.options));
      } else {
        res.set("Content-Type", "application/json");
        res.status(200).send(JSON.stringify(fetchParams, null, 2));
      }
    });
    //
    return router;
  };

  this.getMiddleware = function(express) {
    return {
      name: "saola-plugin-restfront-supporter-restapi",
      path: contextPath,
      middleware: this.buildRestRouter(express)
    };
  };
}

function buildUrl (urlObject, pathname, query) {
  urlObject = lodash.clone(urlObject);
  urlObject.pathname = pathname;
  if (lodash.isObject(query)) {
    urlObject.query = query;
  }
  return url.format(urlObject);
}

function Renderer ({ urlObject, pathPattern, descriptor }) {
  const method = lodash.get(descriptor, "method", "GET");
  const sampleStore = lodash.get(descriptor, "sample", {});
  //
  this.getDescriptor = function() {
    return descriptor;
  };
  //
  this.isSampleAvailable = function() {
    return lodash.isFunction(sampleStore.getNames) &&
        lodash.isFunction(sampleStore.getScenario);
  };
  //
  this.getSampleNames = function() {
    if (lodash.isFunction(sampleStore.getNames)) {
      return sampleStore.getNames();
    }
    return [];
  };
  //
  this.buildFetchParams = function ({ scenarioName } = {}) {
    scenarioName = scenarioName || "default";
    const sample = sampleStore.getScenario(scenarioName);
    const sampleRequest = lodash.get(sample, "request", {});
    //
    const sampleParams = lodash.get(sampleRequest, "params", {});
    const realPath = replaceParametersInUrl(pathPattern, sampleParams);
    const realUrl = buildUrl(urlObject, realPath, sampleRequest.query);
    //
    const sampleResponse = lodash.get(sample, ["response", "contains"], {});
    //
    const statusCode = lodash.get(sampleResponse, ["statusCode"], -1);
    const statusText = lodash.get(sampleResponse, ["statusText"], "OK");
    const headers = lodash.get(sampleResponse, ["headers"], {});
    const body = lodash.get(sampleResponse, ["body"], null);
    //
    return {
      url: realUrl,
      options: Object.assign({ method }, lodash.pick(sampleRequest, ["headers", "body"], {})),
      mockout: { statusCode, statusText, headers, body },
    };
  };
  //
  this.getResponseChecker = function ({ scenarioName } = {}) {
    scenarioName = scenarioName || "default";
    const sample = sampleStore.getScenario(scenarioName);
    const checker = lodash.get(sample, ["response", "checker"]);
    if (!checker) {
      return undefined;
    }
    if (lodash.isFunction(checker)) {
      return checker;
    }
    return null;
  };
}

module.exports = Service;
