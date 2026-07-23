import assert from "node:assert/strict";
import test from "node:test";
import {
  detectImage,
  isStoredImagePath,
  storedImagePath,
  uploadDirectory,
} from "./image-upload.ts";

test("detects supported image signatures and rejects spoofed files", () => {
  assert.equal(detectImage(Uint8Array.from([0xff, 0xd8, 0xff]))?.extension, "jpg");
  assert.equal(
    detectImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension,
    "png",
  );
  assert.equal(
    detectImage(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))?.extension,
    "webp",
  );
  assert.equal(detectImage(new TextEncoder().encode("not really an image")), null);
});

test("builds and validates category, frame, dated user, and topic word paths", () => {
  const filename = "123e4567-e89b-42d3-a456-426614174000.webp";
  assert.deepEqual(uploadDirectory("category"), ["category"]);
  assert.deepEqual(uploadDirectory("frame"), ["frame"]);
  assert.deepEqual(uploadDirectory("user", undefined, new Date(2012, 11, 12)), ["user", "12-12-2012"]);
  assert.deepEqual(uploadDirectory("word", "500 toeic"), ["word", "500_toeic"]);
  assert.equal(isStoredImagePath(["category", filename]), true);
  assert.equal(isStoredImagePath(["frame", filename]), true);
  assert.equal(isStoredImagePath(["user", "12-12-2012", filename]), true);
  assert.equal(isStoredImagePath(["word", "1000_Word_common", filename]), true);
  assert.deepEqual(storedImagePath(`/uploads/word/500_toeic/${filename}`), ["word", "500_toeic", filename]);
  assert.equal(storedImagePath(`/uploads/word/../${filename}`), null);
  assert.equal(storedImagePath(`https://example.com/uploads/category/${filename}`), null);
});
