import assert from "node:assert/strict";
import test from "node:test";
import { OFF_TOPIC_REPLY, offTopicReply } from "../lib/customer-assistant-policy.ts";

test("clearly off-topic requests get the canned WattWise-only reply", () => {
  for (const message of [
    "can you give me a c programming code for bubble sort",
    "write me a C program that prints hello world",
    "Python code for a calculator please",
    "gawan mo ako ng essay tungkol sa pag-ibig",
    "help me with my homework",
    "#include <stdio.h> int main() { printf(\"hi\"); }",
    "```js\nconsole.log(1)\n```",
  ]) {
    assert.equal(offTopicReply(message), OFF_TOPIC_REPLY, message);
  }
});

test("energy questions always reach the assistant, even with code-like words", () => {
  for (const message of [
    "Why is my bill high?",
    "Turn off my aircon at 1 am",
    "patayin mo ang TV ng 11:30 pm",
    "Write a script that turns off my aircon at 1 am",
    "Bakit mataas ang kuryente namin?",
    "how do I save energy",
    "Kumusta?",
    "What can you do?",
  ]) {
    assert.equal(offTopicReply(message), null, message);
  }
});
