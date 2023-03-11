"use strict";

const Core = require("@saola/core");
const lodash = Core.require("lodash");
const chores = Core.require("chores");
const path = require("path");
const url = require("url");

const { PortletMixiner } = Core.require("portlet");

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

  const contextPath = portletConfig.supportPath || "/_/restfront";
  const helpUrl = buildUrl(contextPath);

  L && L.has("silly") && L.log("silly", T && T.add({ blockRef, portletName, contextPath }).toMessage({
    tags: [ blockRef ],
    text: "The Portlet[${blockRef}][${portletName}] is available for: '${contextPath}'"
  }));

  const generalPath = restfrontHandler.getGeneralPath();
  const mappingHash = restfrontHandler.getMappingHash();

  function transformMappings (generalPath, mappingHash, mappingRefs = {}) {
    lodash.forOwn(mappingHash, function(mappingBundle, mappingName) {
      const list = mappingBundle.apiMaps;
      if (!lodash.isArray(list)) {
        return;
      }
      lodash.forEach(list, function(item) {
        item = Object.assign({ mappingName }, lodash.cloneDeep(item));
        if (lodash.isArray(item.path)) {
          lodash.forEach(item.path, function(subPath) {
            subPath = path.join(generalPath, subPath);
            lodash.set(mappingRefs, subPath, item);
          });
        }
        if (lodash.isString(item.path)) {
          item.path = path.join(generalPath, item.path);
          lodash.set(mappingRefs, item.path, item);
        }
      });
    });
    return mappingRefs;
  }

  const mappingDefs = transformMappings(generalPath, mappingHash);

  this.buildRestRouter = function (express) {
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
      let tmplPath = req.path;
      if (lodash.isString(tmplPath)) {
        tmplPath = tmplPath.replace(contextPath, "");
      }
      //
      const mapping = lodash.get(mappingDefs, tmplPath);
      //
      if (!lodash.isObject(mapping) || lodash.isEmpty(mapping)) {
        if (format === "curl") {
          res.set("Content-Type", "text/plain");
          res.status(400).send(`echo 'The descriptor of [${tmplPath}] not found. See: ${helpUrl}'`);
        } else {
          res.set("Content-Type", "application/json");
          res.status(400).send(JSON.stringify({
            url: tmplPath,
            message: "The descriptor of the [url] not found",
            helpUrl: helpUrl,
          }));
        }
        return;
      }
      //
      const sampleStore = lodash.get(mapping, "sample", {});
      if (!lodash.isFunction(sampleStore.getScenario)) {
        if (format === "curl") {
          res.set("Content-Type", "text/plain");
          res.status(400).send(`echo 'The sample of [${tmplPath}] is not defined. See: ${helpUrl}'`);
        } else {
          res.set("Content-Type", "application/json");
          res.status(400).send(JSON.stringify({
            url: tmplPath,
            message: "The sample of the [url] is not defined",
            helpUrl: helpUrl,
          }));
        }
        return;
      }
      //
      const method = lodash.get(mapping, "method", "GET");
      const sample = sampleStore.getScenario("default");
      const sampleRequest = lodash.get(sample, "request", {});
      //
      const realPath = replaceParametersInUrl(tmplPath, lodash.get(sampleRequest, "params", {}));
      const realUrl = buildUrl(realPath, sampleRequest.query);
      //
      if (format === "curl") {
        res.set("Content-Type", "text/plain");
        res.status(200).send(renderCurlScript(realUrl, Object.assign({
          method
        }, lodash.pick(sampleRequest, ["headers", "body"], {}))));
      } else {
        res.set("Content-Type", "application/json");
        res.status(200).send(JSON.stringify({
          url: realUrl,
          options: Object.assign({
            method
          }, lodash.pick(sampleRequest, ["headers", "body"], {}))
        }, null, 2));
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

  function buildUrl (urlPath, query) {
    const urlObject = {};
    urlObject.protocol = webserverHandler.protocol;
    urlObject.hostname = webserverHandler.hostname;
    urlObject.port = webserverHandler.port;
    urlObject.pathname = urlPath;
    if (lodash.isObject(query)) {
      urlObject.query = query;
    }
    return url.format(urlObject);
  }
}

module.exports = Service;
