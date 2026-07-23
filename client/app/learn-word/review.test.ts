import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the .ts extension.
import {
  applyHint,
  getAnswerReveal,
  getReviewHint,
  maskAnswer,
  mergeUnitProgress,
  normalizeAnswer,
  shuffle,
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
  assert.equal(applyHint("apple", "", 1), "a");
  assert.equal(applyHint("apple", "", 2), "ap");
  assert.equal(applyHint("shopping habit", "shopping", 0), "shopping");
  assert.equal(applyHint("shopping habit", "shoppinghabit", 0), "shopping habit");
  assert.equal(applyHint("co-operate", "co-", 0), "co");
  assert.equal(applyHint("co-operate", "cooperate", 0), "co-operate");
  assert.equal(applyHint("check-up", "checkup", 0), "check-up");
  assert.equal(applyHint("word, phrase", "wordphrase", 0), "word, phrase");
  assert.equal(applyHint("co-operate", "co-operate-too-long", 0), "co-operate");
});

test("completed progress survives replay", () => {
  const completed = { learned: 20, total: 20, completed: true };
  assert.deepEqual(mergeUnitProgress(completed, 0, 20), completed);
});

test("legacy progress count survives before card IDs are available", () => {
  assert.deepEqual(mergeUnitProgress({ learned: 4, total: 20, completed: false }, 0, 20), {
    learned: 4,
    total: 20,
    completed: false,
  });
});

test("shuffle changes a copy, not the API result", () => {
  const cards = [1, 2, 3, 4];
  const random = Math.random;
  Math.random = () => 0;
  try {
    assert.deepEqual(shuffle(cards), [2, 3, 4, 1]);
    assert.deepEqual(cards, [1, 2, 3, 4]);
  } finally {
    Math.random = random;
  }
});
