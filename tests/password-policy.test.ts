import assert from "node:assert/strict";
import test from "node:test";
import { PASSWORD_RULES, validateNewPassword } from "../lib/password-policy.ts";

test("accepts a password with length, upper, lower, number and symbol", () => {
  assert.equal(validateNewPassword("Tipid2026!"), null);
  assert.equal(validateNewPassword("aA1~aaaa"), null);
});

test("names exactly what is missing", () => {
  assert.equal(validateNewPassword(""), "Create a password.");
  assert.equal(validateNewPassword("tipid2026!"), "Add an uppercase letter.");
  assert.equal(validateNewPassword("Tipid!!!!"), "Add a number.");
  assert.equal(validateNewPassword("Tipid2026"), "Add a symbol.");
  assert.equal(validateNewPassword("Ab1!"), "Add at least 8 characters.");
  assert.equal(validateNewPassword("password"), "Add an uppercase letter, a number and a symbol.");
});

test("only Supabase Auth's symbols count, so the form never passes what Supabase rejects", () => {
  assert.equal(validateNewPassword("Tipid 2026"), "Add a symbol.");
  assert.equal(validateNewPassword("Tipid2026₱"), "Add a symbol.");
  assert.equal(validateNewPassword("Tipid2026\\"), null);
});

test("every rule has a checklist label", () => {
  assert.deepEqual(
    PASSWORD_RULES.map((rule) => rule.id),
    ["length", "upper", "lower", "number", "symbol"],
  );
});
