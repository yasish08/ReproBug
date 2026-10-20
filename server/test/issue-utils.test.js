import test from "node:test";
import assert from "node:assert/strict";
import { createIssueFingerprint, normalizePageUrl } from "../src/lib/issue-utils.js";

test("fingerprint is deterministic", () => {
  assert.equal(
    createIssueFingerprint("TypeError: failed", "cannot read property"),
    createIssueFingerprint("TypeError: failed", "cannot read property")
  );
});

test("fingerprint ignores surrounding whitespace and letter case", () => {
  assert.equal(
    createIssueFingerprint("  Checkout Failed  ", "  BAD STATE "),
    createIssueFingerprint("checkout failed", "bad state")
  );
});

test("different diagnostic messages produce different fingerprints", () => {
  assert.notEqual(
    createIssueFingerprint("Request failed", "timeout"),
    createIssueFingerprint("Request failed", "unauthorized")
  );
});

test("empty page URL is accepted as absent", () => {
  assert.deepEqual(normalizePageUrl(""), { valid: true, value: null });
  assert.deepEqual(normalizePageUrl(undefined), { valid: true, value: null });
});

test("normalizes valid HTTP and HTTPS URLs", () => {
  assert.deepEqual(normalizePageUrl("https://example.com/path"), {
    valid: true,
    value: "https://example.com/path"
  });
  assert.deepEqual(normalizePageUrl("http://example.com"), {
    valid: true,
    value: "http://example.com/"
  });
});

test("rejects non-web, malformed, non-string, and overlong URLs", () => {
  assert.equal(normalizePageUrl("javascript:alert(1)").valid, false);
  assert.equal(normalizePageUrl("file:///etc/passwd").valid, false);
  assert.equal(normalizePageUrl("not a url").valid, false);
  assert.equal(normalizePageUrl(123).valid, false);
  assert.equal(normalizePageUrl("https://example.com/" + "a".repeat(2048)).valid, false);
});

test("redacts credentials and sensitive query parameters from page URLs", () => {
  assert.deepEqual(normalizePageUrl("https://user:pass@example.com/checkout?token=abc&email=a%40b.com&tab=orders"), {
    valid: true,
    value: "https://example.com/checkout?token=%5BREDACTED%5D&email=%5BREDACTED%5D&tab=orders"
  });
});
