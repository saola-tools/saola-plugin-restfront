"use strict";

const mappings = {
  apiPath: "/sub",
  apiMaps: [
    {
      path: "/:apiVersion/mockser",
      method: "GET",
      requestOptions: {
        requestId: {
          required: false
        }
      },
      input: {
        transform: function (req, reqOpts, services) {
          return {};
        },
      },
      serviceResolver: "@saola/plugin-restfetch/resolver",
      serviceName: "restfetch-example/mockser",
      methodName: "invokeHttps",
      output: {
        transform: function(result, req) {
          return result;
        },
      },
    }
  ],
};

module.exports = mappings;
