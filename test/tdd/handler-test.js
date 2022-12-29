"use strict";

const devebot = require("devebot");
const Promise = devebot.require("bluebird");
const lodash = devebot.require("lodash");
const chores = devebot.require("chores");
const LogConfig = devebot.require("logolite").LogConfig;
const envcloak = require("envcloak").instance;
const { assert, mockit, sinon } = require("liberica");

const Fibonacci = require("../lib/fibonacci");

const errorManager = {
  getErrorBuilder: function() {
    return errorBuilder;
  }
};

const errorBuilder = {
  newError: function(name, options) {
    options = options || {};
    const err = new Error(options.message);
    err.name = name;
    err.payload = options.payload;
    return err;
  }
}

describe("handler", function() {
  const sandboxConfig = {
    "contextPath": "/restfront",
    "apiPath": "rest",
    "mappingStore": {
      "devebot-application": "app-restfront/test/app/example/lib/mappings/req-to-rpc"
    },
    "static": {
      "apidoc": "app-restfront/test/app/example/public/apidoc",
      "assets": "app-restfront/test/app/example/public/assets"
    },
    "requestOptions": {
      "requestId": {
        "headerName": "X-Request-Id",
        "optionName": "requestId",
        "required": false
      },
      "segmentId": {
        "headerName": "X-Segment-Id"
      },
      "platformApp": {
        "headerName": "X-Platform-App"
      },
      "schemaVersion": {
        "headerName": "X-Schema-Version"
      },
      "clientType": {
        "headerName": "X-App-Type"
      },
      "clientVersion": {
        "headerName": "X-App-Version"
      },
      "languageCode": {
        "headerName": "X-Lang-Code"
      },
      "appTierType": {
        "headerName": "X-Tier-Type"
      },
      "appUserType": {
        "headerName": "X-User-Type"
      },
      "mockSuite": {
        "headerName": "X-Mock-Suite"
      },
      "mockState": {
        "headerName": "X-Mock-State"
      }
    },
    "responseOptions": {
      "packageRef": {
        "headerName": "X-Package-Ref"
      },
      "returnCode": {
        "headerName": "X-Return-Code"
      }
    },
    "errorCodes": {
      "RequestOptionNotFound": {
        "message": "Required request options not found",
        "returnCode": 100,
        "statusCode": 400
      },
      "RequestTimeoutOnServer": {
        "message": "Request timeout",
        "returnCode": 101,
        "statusCode": 408
      },
      "RequestPreValidationError": {
        "message": "The http request is invalid",
        "returnCode": 102,
        "statusCode": 400
      },
      "RequestPostValidationError": {
        "message": "The sanitized body is invalid",
        "returnCode": 103,
        "statusCode": 400
      }
    }
  };

  describe("sanitizeMappings()", function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: "app-restfront/handler",
    };

    let Handler, sanitizeMappings;

    beforeEach(function() {
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      sanitizeMappings = mockit.get(Handler, "sanitizeMappings");
    });

    it("push the sanitized mappings into the provided collections", function() {
      const predefinedMappings = {};
      const output = sanitizeMappings({}, predefinedMappings);
      assert.isTrue(output === predefinedMappings);
    });

    it("transform the apimaps to apiMaps and append the apiPath", function() {
      assert.isFunction(sanitizeMappings);
      const mappingHash = {
        example1: [
          {
            path: "/:apiVersion/action1"
          },
          {
            path: [ "/:apiVersion/action2", "/:apiVersion/action2/alias" ]
          }
        ],
        example2: {
          apiPath: "/example2",
          apimaps: [
            {
              path: "/:apiVersion/action1"
            },
            {
              path: [ "/:apiVersion/action2", "/:apiVersion/action2/alias" ]
            }
          ]
        }
      };
      const mappingRefs = sanitizeMappings(mappingHash);
      assert.deepEqual(mappingRefs, {
        "example1": {
          "apiDocs": undefined,
          "apiMaps": [
            {
              "path": "/:apiVersion/action1",
              "input": {
                "mutate": {}
              },
              "inlet": {},
              "output": {
                "mutate": {}
              },
              "error": {
                "mutate": {}
              }
            },
            {
              "path": [
                "/:apiVersion/action2",
                "/:apiVersion/action2/alias"
              ],
              "input": {
                "mutate": {}
              },
              "inlet": {},
              "output": {
                "mutate": {}
              },
              "error": {
                "mutate": {}
              }
            }
          ]
        },
        "example2": {
          "apiDocs": undefined,
          "apiMaps": [
            {
              "path": "/example2/:apiVersion/action1",
              "input": {
                "mutate": {}
              },
              "inlet": {},
              "output": {
                "mutate": {}
              },
              "error": {
                "mutate": {}
              }
            },
            {
              "path": [
                "/example2/:apiVersion/action2",
                "/example2/:apiVersion/action2/alias"
              ],
              "input": {
                "mutate": {}
              },
              "inlet": {},
              "output": {
                "mutate": {}
              },
              "error": {
                "mutate": {}
              }
            }
          ]
        }
      });
    });

    it("append the apiPath to the keys of [paths] in apiDocs", function() {
      assert.isFunction(sanitizeMappings);
      const mappingHash = {
        example3: {
          apiPath: "/example3",
          apiDocs: {
            "swagger": "2.0",
            "host": "api.example.com",
            "basePath": "/v1",
            "produces": [
              "application/json"
            ],
            "paths": {
              "/me": {
                "get": {
                  "summary": "User Profile",
                }
              }
            }
          }
        }
      };
      const mappingRefs = sanitizeMappings(mappingHash);
      assert.deepEqual(mappingRefs, {
        "example3": {
          "apiDocs": {
            "swagger": "2.0",
            "host": "api.example.com",
            "basePath": "/v1",
            "produces": [
              "application/json"
            ],
            "paths": {
              "/example3/me": {
                "get": {
                  "summary": "User Profile",
                }
              }
            }
          }
        }
      });
    });
  });

  describe("upgradeMapping()", function() {
    let Handler, upgradeMapping;

    beforeEach(function() {
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      upgradeMapping = mockit.get(Handler, "upgradeMapping");
    });

    it("Initialize a standard mappings structure when the input is an empty object", function() {
      const mapping = {}
      const expected = {
        "input": {
          "mutate": {}
        },
        "inlet": {},
        "output": {
          "mutate": {}
        },
        "error": {
          "mutate": {}
        }
      };
      const result = upgradeMapping(mapping);
      false && console.log(JSON.stringify(result, null, 2));
      assert.deepEqual(result, expected);
    });

    it("Convert deprecated function names to standard function names", function() {
      const mapping = {
        transformRequest: function(req) {
          return { number: req.params.number };
        },
        transformResponse: function(result, req) {
          return result;
        },
        transformError: function(err, req) {
          return err;
        }
      };
      const expected = {
        "input": {
          "mutate": {
          },
          "transform": lodash.get(mapping, "transformRequest")
        },
        "inlet": {},
        "output": {
          "mutate": {
          },
          "transform": lodash.get(mapping, "transformResponse")
        },
        "error": {
          "mutate": {
          },
          "transform": lodash.get(mapping, "transformError")
        }
      };
      const result = upgradeMapping(mapping);
      false && console.log(JSON.stringify(result, null, 2));
      assert.deepEqual(result, expected);
    });
  });

  describe("mutateRenameFields()", function() {
    let Handler, mutateRenameFields;
    let dataObject;

    beforeEach(function() {
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      mutateRenameFields = mockit.get(Handler, "mutateRenameFields");
      dataObject = {
        name: "Hello, world",
        phoneNumber: "+84972508126",
        age: 27,
        gender: true
      }
    });

    it("do nothing if nameMappings is undefined", function() {
      const original = { abc: 1024, xyz: "Hello world" };
      const output = mutateRenameFields(original, null);
      assert.deepEqual(output, original);
    });

    it("Do nothing with the empty object", function() {
      assert.deepEqual(mutateRenameFields({}, {"name": "newName"}), {});
    });

    it("Do nothing with the empty mappings", function() {
      const mappings = {};
      const expected = lodash.cloneDeep(dataObject);
      assert.deepEqual(mutateRenameFields(dataObject, mappings), expected);
    });

    it("Change the field names based on the namingMappings properly", function() {
      const mappings = {
        "name": "fullname",
        "phoneNumber": "phone.number"
      }
      const expected = {
        fullname: "Hello, world",
        phone: {
          number: "+84972508126"
        },
        age: 27,
        gender: true
      }
      assert.deepEqual(mutateRenameFields(dataObject, mappings), expected);
    });
  });

  describe("extractRequestOptions()", function() {
    const STANDARD_REQ_OPTIONS = [
      "requestId",
      "segmentId",
      "platformApp",
      "schemaVersion",
      "clientType",
      "clientVersion",
      "languageCode",
      "appTierType",
      "appUserType",
      "mockSuite",
      "mockState",
    ];
    let Handler, extractRequestOptions;

    const req = new RequestMock({
      headers: {
        "X-Request-Id": "52160bbb-cac5-405f-a1e9-a55323b17938",
        "X-App-Type": "agent",
        "X-App-Version": "0.1.0",
        "X-Tier-Type": "UAT",
        "X-User-Type": "DEMO",
      }
    });

    beforeEach(function() {
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      extractRequestOptions = mockit.get(Handler, "extractRequestOptions");
    });

    it("convert the requestOption from string type to an object", function() {
      const output = extractRequestOptions(req, { "requestId": "X-Request-Id"} );
      false && console.log(JSON.stringify(output, null, 2));
      const expected = {
        "requestId": "52160bbb-cac5-405f-a1e9-a55323b17938",
      };
      assert.deepInclude(output, expected);
    });

    it("extract the predefined headers properly", function() {
      const output = extractRequestOptions(req, sandboxConfig.requestOptions);
      const expected = {
        "requestId": "52160bbb-cac5-405f-a1e9-a55323b17938",
        "clientType": "agent",
        "clientVersion": "0.1.0",
        "appTierType": "UAT",
        "appUserType": "DEMO",
      };
      assert.deepInclude(output, expected);
      assert.sameMembers(lodash.keys(output), STANDARD_REQ_OPTIONS);
    });

    it("the headers will be overridden by extensions", function() {
      const output = extractRequestOptions(req, sandboxConfig.requestOptions, {
        extensions: {
          requestId: "7f36af79-077b-448e-9c66-fc177996fd10",
          timeout: 1000
        }
      });
      const expected = {
        "requestId": "7f36af79-077b-448e-9c66-fc177996fd10",
        "clientType": "agent",
        "clientVersion": "0.1.0",
        "appTierType": "UAT",
        "appUserType": "DEMO",
        "timeout": 1000
      };
      assert.deepInclude(output, expected);
      assert.sameMembers(lodash.keys(output), STANDARD_REQ_OPTIONS.concat([ "timeout" ]));
    });

    it("the request-options will be overridden by defined extensions only", function() {
      const output = extractRequestOptions(req, sandboxConfig.requestOptions, {
        extensions: {
          requestId: undefined,
          timeout: 1000
        }
      });
      const expected = {
        "requestId": "52160bbb-cac5-405f-a1e9-a55323b17938",
        "clientType": "agent",
        "clientVersion": "0.1.0",
        "appTierType": "UAT",
        "appUserType": "DEMO",
        "timeout": 1000
      };
      assert.deepInclude(output, expected);
      assert.sameMembers(lodash.keys(output), STANDARD_REQ_OPTIONS.concat([ "timeout" ]));
    });

    it("an error occured when a required option in requestOptions is not found in the request headers", function() {
      const requestOptions = lodash.assign({
        "tenantId": {
          "headerName": "X-Tenant-Id",
          "optionName": "tenantId",
          "required": true
        },
      }, sandboxConfig.requestOptions);
      const failedReqOpts = [];
      const output = extractRequestOptions(req, requestOptions, {}, failedReqOpts);
      false && console.log(JSON.stringify(output, null, 2));
      const expected = {
        "tenantId": undefined,
        "requestId": "52160bbb-cac5-405f-a1e9-a55323b17938",
        "clientType": "agent",
        "clientVersion": "0.1.0",
        "appTierType": "UAT",
        "appUserType": "DEMO"
      };
      assert.deepInclude(output, expected);
      false && console.log(JSON.stringify(failedReqOpts, null, 2));
      assert.sameMembers(failedReqOpts, [ "tenantId" ]);
    });

    const config = lodash.assign({ userAgentEnabled: true }, sandboxConfig);

    it("uaParser is safety: should not crack the requests in any case", function() {
      const req = new RequestMock({
        headers: {
          "User-Agent": null
        }
      });
      const output = extractRequestOptions(req, sandboxConfig.requestOptions, config);
      assert.deepEqual(output.userAgent, {});
    });

    it("uaParser is safety: should not crack the requests with wrong user-agent format", function() {
      const req = new RequestMock({
        headers: {
          "User-Agent": "Any string, wrong format"
        }
      });
      const output = extractRequestOptions(req, sandboxConfig.requestOptions, config);
      assert.deepInclude(output.userAgent, {
        "os": {
          "name": undefined,
          "version": undefined
        },
        "ua": "Any string, wrong format"
      });
    });

    it("uaParser parse the user-agent string into JSON object properly", function() {
      const req = new RequestMock({
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.2 (KHTML, like Gecko) Ubuntu/11.10 Chromium/15.0.874.106 Chrome/15.0.874.106 Safari/535.2",
        }
      });
      const output = extractRequestOptions(req, sandboxConfig.requestOptions, config);
      assert.deepInclude(output.userAgent, {
        "browser": {
          "name": "Chromium",
          "version": "15.0.874.106",
          "major": "15"
        },
        "engine": {
          "name": "WebKit",
          "version": "535.2"
        },
        "os": {
          "name": "Ubuntu",
          "version": "11.10"
        },
        "cpu": {
          "architecture": "amd64"
        }
      });
    });
  });

  describe("addDefaultResponseHeaders()", function() {
    let Handler, addDefaultResponseHeaders;

    beforeEach(function() {
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      addDefaultResponseHeaders = mockit.get(Handler, "addDefaultResponseHeaders");
    });

    it("add the default header to the packet", function() {
      const packet = {
        body: {
          message: "Hello world"
        }
      };
      const output = addDefaultResponseHeaders(packet, sandboxConfig.responseOptions);
      assert.deepEqual(output, {
        headers: {
          "X-Return-Code": 0
        },
        body: {
          message: "Hello world"
        }
      });
    });

    it("skip to add the default header to the packet if it has already exists", function() {
      const packet = {
        headers: {
          "X-Return-Code": 1
        },
        body: {
          message: "Hello world"
        }
      };
      const output = addDefaultResponseHeaders(packet, sandboxConfig.responseOptions);
      assert.deepEqual(output, {
        headers: {
          "X-Return-Code": 1
        },
        body: {
          message: "Hello world"
        }
      });
    });
  });

  for (const [index, label] of ["Standard", "Optimized"].entries()) {
    describe("renderPacketToResponse_" + label + "()", function() {
      let Handler, renderPacketToResponse;

      beforeEach(function() {
        Handler = mockit.acquire("handler", { libraryDir: "../lib" });
        renderPacketToResponse = mockit.get(Handler, "renderPacketToResponse_" + label);
      });

      it("render empty packet", function() {
        const res = new ResponseMock();
        renderPacketToResponse({}, res);
        assert.equal(res.set.callCount, 0);
        assert.equal(res.send.callCount, 0);
        assert.equal(res.json.callCount, 0);
        assert.equal(res.end.callCount, 1);
      });

      it("render a packet with body as string", function() {
        const res = new ResponseMock();
        renderPacketToResponse({
          body: "Hello world"
        }, res);
        assert.equal(res.set.callCount, 0);
        assert.equal(res.send.callCount, 1);
        assert.equal(res.json.callCount, 0);
        assert.equal(res.end.callCount, 0);
      });

      it("render a packet with body as object", function() {
        const res = new ResponseMock();
        renderPacketToResponse({
          body: {
            message: "Hello world"
          }
        }, res);
        assert.equal(res.set.callCount, 0);
        assert.equal(res.send.callCount, 0);
        assert.equal(res.json.callCount, 1);
        assert.equal(res.end.callCount, 0);
      });

      it("render with a null headers", function() {
        const res = new ResponseMock();
        renderPacketToResponse({
          headers: null
        }, res);
        assert.equal(res.set.callCount, 0);
      });

      it("render with a headers as a string", function() {
        const res = new ResponseMock();
        renderPacketToResponse({
          headers: "hello world"
        }, res);
        assert.equal(res.set.callCount, 0);
      });

      it("render with invalid headers (boolean/number)", function() {
        const res = new ResponseMock();
        renderPacketToResponse({
          headers: true
        }, res);
        assert.equal(res.set.callCount, 0);
      });

      it("render a packet with 2 headers and empty body", function() {
        const res = new ResponseMock();
        renderPacketToResponse({
          headers: {
            "X-Request-Id": 0,
            "X-Schema-Version": "1.0.0",
          }
        }, res);
        assert.equal(res.set.callCount, 2);
        assert.equal(res.send.callCount, 0);
        assert.equal(res.json.callCount, 0);
        assert.equal(res.end.callCount, 1);
      });
    });
  }

  describe("buildMiddlewareFromMapping()", function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const serviceSelector = {
      lookupMethod: function(serviceName, methodName) {
        return {
          method: function(reqData, reqOpts) {
            return reqData;
          }
        }
      }
    };
    const tracelogService = {
      getRequestId: function(req) {
        return "ADD7D6E0-0736-4B79-98C6-2F0EAE0D671C";
      }
    };
    const ctx = {
      blockRef: "app-restfront/handler",
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      sandboxConfig, errorManager, errorBuilder, serviceSelector, tracelogService
    };

    let Handler, buildMiddlewareFromMapping;

    beforeEach(function() {
      envcloak.setup({
        DEVEBOT_ENV: "development"
      });
      LogConfig.reset();
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      buildMiddlewareFromMapping = mockit.get(Handler, "buildMiddlewareFromMapping");
    });

    afterEach(function() {
      envcloak.reset();
      LogConfig.reset();
    });

    it("call the next() if the HTTP method mismatchs with the mapping", function() {
      const context = { ...ctx };
      const mapping = {};
      const middleware = buildMiddlewareFromMapping(context, mapping);
      assert.isFunction(middleware);
      //
      const req = new RequestMock({});
      const res = new ResponseMock();
      const next = sinon.stub();
      middleware(req, res, next);
      //
      assert.equal(next.callCount, 1);
    });

    it("call the next() if the service method is not a function", function() {
      const serviceSelector = {
        lookupMethod: function(serviceName, methodName) {
          return {
            message: "This is an object - NOT A FUNCTION"
          }
        }
      };
      const context = { ...ctx, serviceSelector };
      const mapping = { method: "GET" };
      const middleware = buildMiddlewareFromMapping(context, mapping);
      assert.isFunction(middleware);
      //
      const req = new RequestMock({ method: "GET" });
      const res = new ResponseMock();
      const next = sinon.stub();
      middleware(req, res, next);
      //
      assert.equal(next.callCount, 1);
    });

    it("Invoke a HTTP request to middleware with minimal default parameters", function() {
      const context = { ...ctx };
      const mapping = { method: "GET" };
      const middleware = buildMiddlewareFromMapping(context, mapping);
      assert.isFunction(middleware);
      //
      const req = new RequestMock({ method: "GET" });
      const res = new ResponseMock();
      const next = sinon.stub();
      //
      const expected = {
        body: undefined,
        headers: {
          "X-Return-Code": 0
        }
      };
      const resultPromise = middleware(req, res, next);
      assert.isNotNull(resultPromise);
      //
      return resultPromise.then(function(info) {
        false && console.log("Output: ", info);
        assert.deepEqual(info, expected);
      }).catch(function(error) {
        true && console.log("Error: ", error);
        assert.fail("This testcase must not be raised");
      }).finally(function() {
        assert.equal(next.callCount, 0);
      });
    });

    it("Invoke a HTTP request to middleware with input/output data transformation and renaming fields", function() {
      const context = { ...ctx };
      const mapping = {
        method: "GET",
        input: {
          transform: function (req, reqOpts, services) {
            return req.body;
          },
          mutate: {
            rename: {
              "name": "fullname"
            }
          }
        },
        output: {
          transform: function (result, req, reqOpts, services) {
            return {
              body: result
            };
          },
          mutate: {
            rename: {}
          }
        }
      };
      const middleware = buildMiddlewareFromMapping(context, mapping);
      assert.isFunction(middleware);
      //
      const req = new RequestMock({
        method: "GET",
        body: {
          name: "John Doe",
          email: "john.doe@gmail.com",
          phoneNumber: "+84962306028",
        }
      });
      const res = new ResponseMock();
      const next = sinon.stub();
      const expected = {
        body: {
          email: 'john.doe@gmail.com',
          phoneNumber: '+84962306028',
          fullname: 'John Doe'
        },
        headers: {
          "X-Return-Code": 0
        }
      };
      const resultPromise = middleware(req, res, next);
      //
      assert.isNotNull(resultPromise);
      //
      return resultPromise.then(function(info) {
        false && console.log("Output: ", info);
        assert.deepEqual(info, expected);
      }).catch(function(error) {
        true && console.log("Error: ", error);
        assert.fail("This testcase must not be raised");
      }).finally(function() {
        assert.equal(next.callCount, 0);
      });
    });

    for(const functionType of ["synchronous", "promise"]) {
    it("full of successful flow in the " + functionType + " case", function() {
      const serviceSelector = {
        lookupMethod: function(serviceName, methodName) {
          return {
            method: function(data, opts) {
              opts = opts || {};
              if (!data.number || data.number < 0 || data.number > 50) {
                return {
                  input: data,
                  message: "invalid input number"
                };
              }
              const fibonacci = new Fibonacci(data);
              const result = fibonacci.finish();
              result.requestId = opts.requestId;
              if (functionType == "promise") {
                return Promise.resolve(result);
              }
              return result;
            }
          }
        }
      };
      const context = { ...ctx, serviceSelector };
      const mapping = {
        method: "GET",
        input: {
          preValidator: function (req, reqOpts, services) {
            if (functionType == "promise") {
              return Promise.resolve(true);
            }
            return true;
          },
          transform: function (req, reqOpts, services) {
            const result = { number: req.params.number };
            if (functionType == "promise") {
              return Promise.resolve(result);
            }
            return result;
          },
          postValidator: function (data, reqOpts, services) {
            if (data && data.number >= 49) {
              const result = {
                valid: false,
                errorName: "MaximumExceeding",
                errors: [
                  "Maximum input number exceeded"
                ]
              };
              if (functionType == "promise") {
                return Promise.resolve(result);
              }
              return result;
            }
            //
            if (functionType == "promise") {
              return Promise.resolve(true);
            }
            return true;
          },
        },
        output: {
          transform: function (result, req, reqOpts, services) {
            const packet = {
              headers: {
                "X-Request-Id": reqOpts.requestId,
                "X-Power-By": "restfront"
              },
              body: result
            }
            if (functionType == "promise") {
              return Promise.resolve(packet);
            }
            return packet;
          }
        }
      };
      const middleware = buildMiddlewareFromMapping(context, mapping);
      assert.isFunction(middleware);
      //
      const req = new RequestMock({
        method: "GET",
        headers: {
          "X-Request-Id": "ADD7D6E0-0736-4B79-98C6-2F0EAE0D671C",
        },
        params: {
          number: 27,
        }
      });
      const res = new ResponseMock();
      const next = sinon.stub();
      const expected = {
        headers: {
          "X-Request-Id": "ADD7D6E0-0736-4B79-98C6-2F0EAE0D671C",
          "X-Power-By": "restfront",
          "X-Return-Code": 0
        },
        body: {
          number: 27,
          step: 27,
          value: 196418,
          requestId: "ADD7D6E0-0736-4B79-98C6-2F0EAE0D671C"
        }
      };
      //
      const resultPromise = middleware(req, res, next);
      assert.isNotNull(resultPromise);
      //
      return resultPromise.then(function(info) {
        false && console.log("Output: ", info);
        assert.deepEqual(info, expected);
      }).catch(function(error) {
        true && console.log("Error: ", error);
        assert.fail("This testcase must not be raised");
      }).finally(function() {
        assert.equal(next.callCount, 0);
        //
        // check the res.status() call
        assert.equal(res.status.callCount, 1);
        const res_status_args = res.status.args[0];
        assert.lengthOf(res_status_args, 1);
        assert.equal(res_status_args[0], 200);
        //
        // check the res.set() call
        assert.equal(res.set.callCount, 3);
        false && console.log("res_set_args: ", res.set.args);
        assert.sameMembers(res.set.args[0], [ 'X-Request-Id', 'ADD7D6E0-0736-4B79-98C6-2F0EAE0D671C' ]);
        assert.sameMembers(res.set.args[1], [ 'X-Power-By', 'restfront' ]);
        //
        // check the res.json() call
        assert.equal(res.json.callCount, 1);
        const res_json_args = res.json.args[0];
        false && console.log("res_json_args: ", res_json_args);
        assert.lengthOf(res_json_args, 1);
        const res_json_arg1 = res_json_args[0];
        assert.deepEqual(res_json_arg1, expected.body);
      });
    });
    }

    it("render a failed response when the required request options are absent", function() {
      this.skip();
    });

    it("render a failed response when the mapping.input.preValidator returns false", function() {
      this.skip();
    });

    it("render a failed response when the mapping.input.preValidator raises an Error", function() {
      this.skip();
    });

    it("render a failed response when the mapping.input.postValidator returns false", function() {
      this.skip();
    });

    it("render a failed response when the mapping.input.postValidator raises an Error", function() {
      this.skip();
    });

    it("render a failed response when the processing time exceeds the timeout", function() {
      const context = { ...ctx };
      const mapping = {
        method: "GET",
        inlet: {
          process: function (serviceMethod, res, reqData, reqOpts, services) {
            return Promise.delay(1000).then(function() {
              return {};
            });
          }
        },
        error: {
          transform: function(failed, req, reqOpts, services) {
            return failed;
          },
          mutate: {
            rename: {}
          }
        },
        timeout: 500
      };
      const middleware = buildMiddlewareFromMapping(context, mapping);
      assert.isFunction(middleware);
      //
      const req = new RequestMock();
      const res = new ResponseMock();
      const next = sinon.stub();
      const resultPromise = middleware(req, res, next);
      //
      assert.isNotNull(resultPromise);
      //
      return resultPromise.then(function(info) {
        true && console.log("Output: ", info);
        assert.fail("This testcase must raise a timeout Error");
      }).catch(function(error) {
        false && console.log("Error: ", error);
        assert.equal(error.name, "RequestTimeoutOnServer");
      });
    });

    it("service method is a normal function, but it raises a string based error", function() {
      const context = { ...ctx };
      const mapping = {
        method: "GET",
        inlet: {
          process: function (serviceMethod, res, reqData, reqOpts, services) {
            return Promise.reject("Error in string type");
          }
        }
      };
      const middleware = buildMiddlewareFromMapping(context, mapping);
      assert.isFunction(middleware);
      //
      const req = new RequestMock();
      const res = new ResponseMock();
      const next = sinon.stub();
      const resultPromise = middleware(req, res, next);
      //
      assert.isNotNull(resultPromise);
      //
      return resultPromise.then(function(info) {
        true && console.log("Output: ", info);
        assert.fail("This testcase must raise a string Error");
      }).catch(function(error) {
        false && console.log("Error: ", error);
        assert.equal(error, "Error in string type");
      });
    });
  });

  describe("transformErrorObject()", function() {
    let Handler, transformErrorObject;

    beforeEach(function() {
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      transformErrorObject = mockit.get(Handler, "transformErrorObject");
    });

    it("convert a normal error object to a JSON response body", function() {
      const error = {
        statusCode: 400,
        returnCode: 1001,
        name: "ResourceNotFoundError",
        payload: {
          "id": "74FC97E2-0CEC-4CC2-98CF-9B6C36E6853E"
        }
      };
      const expected = {
        "statusCode": 400,
        "headers": {
          "X-Return-Code": 1001
        },
        "body": {
          "name": "ResourceNotFoundError",
          "message": undefined,
          "payload": {
            "id": "74FC97E2-0CEC-4CC2-98CF-9B6C36E6853E"
          }
        }
      };
      const result = transformErrorObject(error, sandboxConfig.responseOptions);
      false && console.log(JSON.stringify(result, null, 2));
      assert.deepEqual(lodash.omit(result, ["body.stack"]), expected);
    });
  });

  describe("transformScalarError()", function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: "app-restfront/handler",
    };

    let Handler, transformScalarError;

    beforeEach(function() {
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      transformScalarError = mockit.get(Handler, "transformScalarError");
    });

    it("error is null", function() {
      assert.deepEqual(transformScalarError(null), {
        statusCode: 500,
        headers: {
          "X-Return-Code": -1,
        },
        body: {
          type: "null",
          message: "Error is null"
        }
      });
    });

    it("error is undefined", function() {
      assert.deepEqual(transformScalarError(), {
        statusCode: 500,
        headers: {
          "X-Return-Code": -1,
        },
        body: {
          type: "undefined",
          message: "Error: undefined",
          payload: undefined
        }
      });
    });

    it("error is a boolean value", function() {
      assert.deepEqual(transformScalarError(true), {
        statusCode: 500,
        headers: {
          "X-Return-Code": -1,
        },
        body: {
          type: "boolean",
          message: "Error: true",
          payload: true
        }
      });
    });

    it("error is a string", function() {
      assert.deepEqual(transformScalarError("This is an error"), {
        statusCode: 500,
        headers: {
          "X-Return-Code": -1,
        },
        body: {
          type: "string",
          message: "This is an error"
        }
      });
    });

    it("error is an array", function() {
      const err = new Error("Failed");
      assert.deepEqual(transformScalarError([ "Error", err ]), {
        statusCode: 500,
        headers: {
          "X-Return-Code": -1,
        },
        body: {
          type: "array",
          payload: [
            "Error", err
          ]
        }
      });
    });

    it("error is an empty object", function() {
      assert.deepEqual(transformScalarError({}), {
        statusCode: 500,
        headers: {
          "X-Return-Code": -1,
        },
        body: {}
      });
    });

    it("error is an unstructured object", function() {
      assert.deepEqual(transformScalarError({
        abc: "Hello world",
        xyz: 1024
      }), {
        statusCode: 500,
        headers: {
          "X-Return-Code": -1,
        },
        body: {
          abc: "Hello world",
          xyz: 1024
        }
      });
    });

    it("error is a structured object", function() {
      assert.deepEqual(transformScalarError({
        statusCode: 400,
        returnCode: 1001,
        headers: {
          "ContentType": "application/json",
        },
        body: {
          message: "Hello world",
          payload: {
            price: 12000
          }
        }
      }, sandboxConfig.responseOptions), {
        statusCode: 400,
        headers: {
          "ContentType": "application/json",
          "X-Return-Code": 1001,
        },
        body: {
          message: "Hello world",
          payload: {
            price: 12000
          }
        }
      });
    });
  });

  describe("isMethodIncluded", function() {
    let Handler, isMethodIncluded;

    beforeEach(function() {
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      isMethodIncluded = mockit.get(Handler, "isMethodIncluded");
    });

    it("Return 'false' if reqMethod is empty", function() {
      assert.isFalse(isMethodIncluded([], ""));
    });

    it("Return 'false' if reqMethod is empty", function() {
      assert.isFalse(isMethodIncluded(["", "Put"], ""));
    });

    it("Return 'false' if the support methods is empty", function() {
      assert.isFalse(isMethodIncluded([], "Get"));
    });

    it("Return 'false' if reqMethod does not match any support methods", function() {
      assert.isFalse(isMethodIncluded(["GET", "post"], "put"));
    });

    it("Return 'true' if reqMethod matchs the support method", function() {
      assert.isTrue(isMethodIncluded("GET", "Get"));
    });

    it("Return 'true' if reqMethod matchs some support methods", function() {
      assert.isTrue(isMethodIncluded(["GET", "post"], "Get"));
    });
  });

  describe("transformErrorToPacket", function() {
    let Handler, transformErrorToPacket;

    beforeEach(function() {
      chores.setEnvironments({
        DEVEBOT_ENV: "development",
        DEVEBOT_UPGRADE_ENABLED: "app-restfront-legacy-error-to-response",
      });
      Handler = mockit.acquire("handler", { libraryDir: "../lib" });
      transformErrorToPacket = mockit.get(Handler, "transformErrorToPacket");
    });

    afterEach(function() {
      chores.clearCache();
    });

    it("Return a 500 error with an empty mapping", function() {
      const mapping = {};
      const req = new RequestMock({
        method: "GET"
      });
      const reqOpts = {};
      const services = {};
      const failed = errorBuilder.newError("ObjectNotFound", {
        message: "The searching returns an empty result",
        payload: {
          q: "hello"
        }
      });
      const responseOptions = sandboxConfig.responseOptions;
      //
      const packet = transformErrorToPacket(failed, mapping, req, reqOpts, services, responseOptions);
      false && console.log(JSON.stringify(packet, null, 2));
    });
  });
});

function RequestMock (defs = {}) {
  const store = { };

  store.headers = lodash.mapKeys(defs.headers, function(value, key) {
    return lodash.lowerCase(key);
  });

  this.get = function(name) {
    return store.headers[lodash.lowerCase(name)];
  };

  Object.defineProperties(this, {
    url: {
      get: function() {
        return defs.url;
      }
    },
    method: {
      get: function() {
        return defs.method || "GET";
      }
    },
    params: {
      get: function() {
        return defs.params || {};
      }
    },
    body: {
      get: function() {
        return defs.body;
      }
    }
  });
}

function ResponseMock (defs = {}) {
  this.set = sinon.stub();
  this.status = sinon.stub();
  this.send = sinon.stub();
  this.json = sinon.stub();
  this.end = sinon.stub();
}
