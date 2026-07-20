"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(
  path.join(__dirname, "..", "Link-Cleaner.js"),
  "utf8"
);

function execute(url) {
  let result;
  vm.runInNewContext(script, {
    $request: { url },
    $done(value) {
      result = value;
    },
    console: { log() {} },
  });
  return result;
}

test("removes UTM parameters while preserving content parameters and fragments", () => {
  const result = execute(
    "https://www.zhihu.com/question/1?utm_source=share&id=42&utm_campaign=spring#answer-2"
  );

  assert.equal(
    result.url,
    "https://www.zhihu.com/question/1?id=42#answer-2"
  );
});

test("removes Bilibili and share tracking parameters case-insensitively", () => {
  const result = execute(
    "https://www.bilibili.com/video/BV1?SPM_ID_FROM=333.1&vd_source=abc&share_source=copy_web&title=demo"
  );

  assert.equal(
    result.url,
    "https://www.bilibili.com/video/BV1?title=demo"
  );
});

test("preserves signatures, tokens, IDs and ordinary source parameters", () => {
  const input =
    "https://weibo.com/detail/1?token=secret&signature=signed&id=1&source=feed";
  const result = execute(input);

  assert.equal(Object.keys(result).length, 0);
});

test("removes all tracking parameters without leaving a dangling question mark", () => {
  const result = execute(
    "https://weibo.com/?utm_medium=social&share_from=copy#top"
  );

  assert.equal(result.url, "https://weibo.com/#top");
});

test("passes URLs without a query string through unchanged", () => {
  const result = execute("https://www.bilibili.com/");

  assert.equal(Object.keys(result).length, 0);
});
