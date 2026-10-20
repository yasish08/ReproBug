import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

let server;
let baseUrl;
const testRunId = Date.now().toString(36);
const projectSlug = `test-${testRunId}`;
const testEmail = `integration-${testRunId}@example.test`;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await prisma.issueEvent.deleteMany({ where: { issue: { project: { slug: projectSlug } } } });
  await prisma.issue.deleteMany({ where: { project: { slug: projectSlug } } });
  await prisma.project.deleteMany({ where: { slug: projectSlug } });
  await prisma.project.deleteMany({ where: { slug: { startsWith: "workspace-" } } });
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
});

test("health reports connected database", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.database, "connected");
  assert.equal(body.service, "reprobug-api");
});

test("issue reporting validates input and rejects unsafe URLs", async () => {
  const invalidTitle = await fetch(`${baseUrl}/api/issues`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "x", projectSlug })
  });
  assert.equal(invalidTitle.status, 400);

  const unsafeUrl = await fetch(`${baseUrl}/api/issues`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Unsafe URL test", pageUrl: "javascript:alert(1)", projectSlug })
  });
  assert.equal(unsafeUrl.status, 400);
});

test("reporting deduplicates repeated errors and increments occurrence count", async () => {
  const payload = {
    title: "  Checkout crashes after coupon  ",
    message: "TypeError: checkout is undefined",
    severity: "HIGH",
    pageUrl: "https://example.com/checkout",
    projectSlug
  };
  const firstResponse = await fetch(`${baseUrl}/api/issues`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
  });
  const first = await firstResponse.json();
  assert.equal(firstResponse.status, 201);
  assert.equal(first.data.title, "Checkout crashes after coupon");
  assert.equal(first.data.occurrenceCount, 1);
  assert.equal(first.deduplicated, false);

  const secondResponse = await fetch(`${baseUrl}/api/issues`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
  });
  const second = await secondResponse.json();
  assert.equal(secondResponse.status, 201);
  assert.equal(second.data.id, first.data.id);
  assert.equal(second.data.occurrenceCount, 2);
  assert.equal(second.deduplicated, true);
});

test("issues can be filtered and status changes are persisted", async () => {
  const create = await fetch(`${baseUrl}/api/issues`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Profile page crashes", severity: "CRITICAL", projectSlug })
  });
  const created = await create.json();
  const listedResponse = await fetch(`${baseUrl}/api/issues?projectId=${created.data.project.id}&severity=CRITICAL`);
  const listed = await listedResponse.json();
  assert.equal(listedResponse.status, 200);
  assert.ok(listed.data.some(issue => issue.id === created.data.id));

  const update = await fetch(`${baseUrl}/api/issues/${created.data.id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "RESOLVED" })
  });
  const updated = await update.json();
  assert.equal(update.status, 200);
  assert.equal(updated.data.status, "RESOLVED");

  const invalid = await fetch(`${baseUrl}/api/issues/${created.data.id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "NOT_A_STATUS" })
  });
  assert.equal(invalid.status, 400);
});

test("registration, login, and authenticated profile work", async () => {
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "correct-horse-battery", name: "Integration Tester" })
  });
  const registered = await register.json();
  assert.equal(register.status, 201);
  assert.equal(registered.data.user.email, testEmail);
  assert.ok(registered.data.token);
  assert.equal(registered.data.workspace.name, "Integration Tester's workspace");

  const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "correct-horse-battery" })
  });
  assert.equal(duplicate.status, 409);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "correct-horse-battery" })
  });
  const loggedIn = await login.json();
  assert.equal(login.status, 200);
  assert.ok(loggedIn.data.token);

  const meUnauthenticated = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(meUnauthenticated.status, 401);
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { authorization: `Bearer ${loggedIn.data.token}` } });
  const profile = await me.json();
  assert.equal(me.status, 200);
  assert.equal(profile.data.email, testEmail);

  const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "wrong-password" })
  });
  assert.equal(badLogin.status, 401);
});
