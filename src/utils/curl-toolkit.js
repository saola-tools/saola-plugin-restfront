"use strict";

const Core = require("@saola/core");
const lodash = Core.require("lodash");

const { compile } = require("path-to-regexp");

function getPureUrlPath (originalUrl) {
  return originalUrl.split("?").shift();
}

function replaceParametersInUrl (urlWithParams, params) {
  const toPath = compile(urlWithParams, { encode: encodeURIComponent });
  return toPath(params);
}

function renderCurlScript (url, options) {
  return joinScriptLines(...standardizeArguments(url, options));
}

function standardizeArguments (urlOrOptions, optionsWithoutUrl) {
  let url, options;
  //
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  if (typeof urlOrOptions === "string" || urlOrOptions instanceof URL) {
    url = urlOrOptions;
    options = optionsWithoutUrl || {};
  } else {
    url = (urlOrOptions || {}).url;
    options = urlOrOptions || {};
  }
  //
  return [ url, options ];
}

function joinScriptLines (url, options) {
  const parts = [ `curl "${url}"`, `${generateMethod(options)}` ];
  //
  const headers = generateHeader(options);
  if (!lodash.isEmpty(headers.params)) {
    parts.push(...headers.params);
  }
  //
  const { body } = options;
  if (body) {
    const bodyString = `${generateBody(body)}`;
    if (!lodash.isEmpty(bodyString)) {
      parts.push(bodyString);
    }
  }
  //
  const compressString = `${generateCompress(headers.isEncode)}`;
  if (!lodash.isEmpty(compressString)) {
    parts.push(compressString);
  }
  //
  return parts.join(" \\\n");
}

//
// https://fetch.spec.whatwg.org/#methods
//
function generateMethod (options) {
  const method = options.method;
  if (!method) return "";
  const type = {
    GET: " -X GET",
    POST: " -X POST",
    PUT: " -X PUT",
    PATCH: " -X PATCH",
    DELETE: " -X DELETE",
    HEAD: " -X HEAD",
    OPTIONS: " -X OPTIONS"
  };
  return type[method.toUpperCase()] || "";
}

function generateHeader (options = {}) {
  const { headers } = options;
  let isEncode = false;
  let headerParams = [];
  //
  Object.keys(headers).map(name => {
    if (name.toLocaleLowerCase() !== "content-length") {
      headerParams.push(getHeaderString(name, lodash.get(headers, name)));
    }
    if (name.toLocaleLowerCase() === "accept-encoding") {
      isEncode = true;
    }
  });
  //
  return {
    params: headerParams,
    isEncode,
  };
}

function getHeaderString (name, val) {
  return ` -H "${name}: ${`${val}`.replace(/(\\|")/g, "\\$1")}"`;
}

function generateCompress (isEncode) {
  return isEncode ? " --compressed" : "";
}

function generateBody (body) {
  if (!body) return "";
  if (typeof body === "object") {
    return ` --data-binary '${escapeBody(JSON.stringify(body))}'`;
  }
  return ` --data-binary '${escapeBody(body)}'`;
}

function escapeBody (body) {
  if (typeof body !== "string") {
    return body;
  }
  return body.replace(/'/g, "'\\''");
}

module.exports = { getPureUrlPath, replaceParametersInUrl, renderCurlScript };
