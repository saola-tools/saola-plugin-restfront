"use strict";

const devebot = require("devebot");
const lodash = devebot.require("lodash");
const { assert, sinon } = require("liberica");

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

function ifExec (expression, exec) {
  if (expression === undefined) {
    return undefined;
  }
  return exec(expression);
}

function assertSinonStub(stub, expected) {
  const { total, args } = expected || {};
  if (total) {
    assert.equal(stub.callCount, total);
    assert.equal(stub.args.length, total);
  }
  if (args) {
    assert.isAtMost(args.length, total);
    for (let i=0; i<args.length; i++) {
      const callArgs = stub.args[i];
      assert.isArray(callArgs);
      //
      const expectedCallArgs = args[i];
      if (expectedCallArgs) {
        assert.isArray(expectedCallArgs);
        assert.equal(callArgs.length, expectedCallArgs.length);
        for (let j=0; j<expectedCallArgs.length; j++) {
          const actualItem = callArgs[j];
          const expectedItem = expectedCallArgs[j];
          assertMatch(actualItem, expectedItem);
        }
      }
    }
  }
}

function assertMatch (actualValue, expectedValue) {
  if (lodash.isArray(expectedValue)) {
    assert.includeDeepOrderedMembers(actualValue, expectedValue);
    return;
  }
  if (lodash.isObject(expectedValue)) {
    assert.deepInclude(actualValue, expectedValue);
    return;
  }
  assert.equal(actualValue, expectedValue);
}

function validateMiddlewareStubs (req, res, next, expected) {
  expected = expected || {};
  if ("next" in expected) {
    assertSinonStub(next, expected["next"]);
  }
  if (lodash.isPlainObject(expected.res)) {
    for (const stubName of ["status", "set", "json", "send", "end"]) {
      if (stubName in expected.res) {
        try {
          assertSinonStub(res[stubName], expected.res[stubName]);
        } catch (err) {
          console.log("stub: %s", stubName);
          console.log("error: %O", err);
        }
      }
    }
  }
}

function validateMiddlewareFlow (req, res, next, flow, expected) {
  expected = expected || {};
  //
  const { silent, failed } = expected;
  //
  assert.isNotNull(flow);
  //
  return flow.then(function(actualTuple) {
    !silent && failed && console.log("Tuple: ", actualTuple);
    const { tuple: expectedTuple } = expected;
    if (expectedTuple !== undefined) {
      assert.deepEqual(actualTuple, expectedTuple);
    }
    if (failed) {
      assert.fail("This testcase must raise an Error");
    }
  }).catch(function(actualError) {
    !silent && !failed && console.log("Error: ", actualError);
    const { error: expectedError } = expected;
    if (expectedError !== undefined) {
      if (expectedError && lodash.isObject(expectedError)) {
        for (const field of ["name", "message", "payload"]) {
          if (field in expectedError) {
            assert.deepEqual(actualError[field], expectedError[field]);
          }
        }
      } else {
        assert.equal(actualError, expectedError);
      }
    }
    if (!failed) {
      assert.fail("This Error should not be raised");
    }
  }).finally(function() {
    validateMiddlewareStubs(req, res, next, lodash.get(expected, "stubs", {}));
  });
}

module.exports = { RequestMock, ResponseMock, validateMiddlewareStubs, validateMiddlewareFlow };
