import test from "node:test";
import assert from "node:assert/strict";
import { authRateLimit } from "../src/middleware/auth-rate-limit.js";

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("authentication rate limiter permits the first 20 requests per IP", () => {
  let nextCalls = 0;
  for (let i = 0; i < 20; i += 1) {
    const res = responseRecorder();
    authRateLimit({ ip: "unit-test-allowed-ip", socket: {} }, res, () => { nextCalls += 1; });
    assert.equal(res.statusCode, 200);
  }
  assert.equal(nextCalls, 20);
});

test("authentication rate limiter blocks excess attempts and returns Retry-After", () => {
  let nextCalls = 0;
  const req = { ip: "unit-test-blocked-ip", socket: {} };
  for (let i = 0; i < 20; i += 1) authRateLimit(req, responseRecorder(), () => { nextCalls += 1; });
  const res = responseRecorder();
  authRateLimit(req, res, () => { nextCalls += 1; });
  assert.equal(res.statusCode, 429);
  assert.ok(Number(res.headers["Retry-After"]) > 0);
  assert.match(res.body.error, /too many/i);
  assert.equal(nextCalls, 20);
});
