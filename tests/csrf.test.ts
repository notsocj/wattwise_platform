import assert from "node:assert/strict";
import test from "node:test";
import { isCrossSiteApiWrite } from "../lib/csrf.ts";

const base = { method: "POST", pathname: "/api/devices/1/relay", origin: "https://www.wattwise-app.site", host: "www.wattwise-app.site", secFetchSite: "same-origin" };

test("allows same-origin writes and every read", () => {
  assert.equal(isCrossSiteApiWrite(base), false);
  assert.equal(isCrossSiteApiWrite({ ...base, method: "GET", origin: "https://evil.example", secFetchSite: "cross-site" }), false);
  assert.equal(isCrossSiteApiWrite({ ...base, pathname: "/login", origin: "https://evil.example" }), false);
});

test("blocks writes from another site", () => {
  assert.equal(isCrossSiteApiWrite({ ...base, origin: "https://evil.example", secFetchSite: "cross-site" }), true);
  assert.equal(isCrossSiteApiWrite({ ...base, method: "DELETE", origin: "https://evil.example", secFetchSite: null }), true);
  assert.equal(isCrossSiteApiWrite({ ...base, origin: "null" }), true);
  assert.equal(isCrossSiteApiWrite({ ...base, origin: null, secFetchSite: "cross-site" }), true);
});

test("leaves non-browser clients without Origin to the route's auth check", () => {
  assert.equal(isCrossSiteApiWrite({ ...base, origin: null, secFetchSite: null }), false);
});
