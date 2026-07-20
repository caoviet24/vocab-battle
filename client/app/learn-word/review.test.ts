import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the .ts extension.
import {
  getAnswerReveal,
  getReviewHint,
  maskAnswer,
  mergeUnitProgress,
  normalizeAnswer,
} from "./review.ts";

test("review answer and progressive hints", () => {
  assert.equal(normalizeAnswer("  Hello   WORLD "), "hello world");
  assert.deepEqual(getReviewHint("apple", 0), {
    pattern: "_ _ _ _ _",
    final: false,
  });
  assert.deepEqual(getReviewHint("apple", 3), {
    pattern: "a p p _ _",
    final: false,
  });
  assert.equal(getReviewHint("apple", 4).final, true);
  assert.equal(maskAnswer("I ate an Apple.", "apple"), "I ate an _____.");
  assert.deepEqual(getAnswerReveal("apple", 3), [
    { char: "a", highlight: false },
    { char: "p", highlight: false },
    { char: "p", highlight: false },
    { char: "l", highlight: true },
    { char: "e", highlight: true },
  ]);
});

test("completed progress survives replay", () => {
  const completed = { learned: 20, total: 20, completed: true };
  assert.deepEqual(mergeUnitProgress(completed, 0, 20), completed);
});
