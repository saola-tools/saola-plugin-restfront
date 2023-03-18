"use strict";

const mappings = {
  apiPath: "/sub",
  apiMaps: [
    {
      path: "/:apiVersion/triangle-area/:base/:height",
      method: "GET",
      requestOptions: {
        requestId: {
          required: false
        }
      },
      input: {
        transform: function (req, reqOpts, services) {
          const { logger: L, tracer: T } = services || {};
          L && L.has("debug") && L.log("debug", T && T.add({
            requestId: reqOpts.requestId
          }).toMessage({
            tmpl: "transform[${requestId}] the request is transforming"
          }));
          return {
            base: parseInt(req.params.base),
            height: parseInt(req.params.height)
          };
        }
      },
      serviceName: "application/formula",
      methodName: "calculateTriangleArea",
      output: {
        transform: function(result, req) {
          return result;
        },
      },
      error: {
        transform: function(failed, req, reqOpts, services) {
          console.log(failed);
          return failed;
        },
      }
    }
  ]
};

module.exports = mappings;
