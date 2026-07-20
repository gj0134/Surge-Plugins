"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(
  path.join(__dirname, "..", "Weibo-Web-AdBlock.js"),
  "utf8"
);

function execute(body) {
  let result;
  vm.runInNewContext(script, {
    $response: { body },
    $done(value) {
      result = value;
    },
    console: { log() {} },
  });
  return result;
}

test("removes marked feed ads while preserving normal posts", () => {
  const input = {
    statuses: [
      { id: "normal-1", isAd: false, text: "正常微博" },
      { id: "ad-1", isAd: 1, promotion: { monitor_log: { adid: "1" } } },
      { id: "ad-2", isAd: true },
      { id: "normal-2", text: "文字里包含广告二字" },
    ],
  };
  const result = execute(JSON.stringify(input));
  const parsed = result.body ? JSON.parse(result.body) : input;

  assert.deepEqual(
    parsed.statuses.map((item) => item.id),
    ["normal-1", "normal-2"]
  );
});

test("removes promotion fallbacks and nested profile ads", () => {
  const input = {
    data: {
      list: [
        { id: "normal", isAd: false },
        { id: "promotion", promotion: { adtype: "feed" } },
        { id: "profile-ad", isAd: "1" },
      ],
    },
  };
  const result = execute(JSON.stringify(input));
  const parsed = result.body ? JSON.parse(result.body) : input;

  assert.deepEqual(
    parsed.data.list.map((item) => item.id),
    ["normal"]
  );
});

test("does not remove hot-search entries based on display labels", () => {
  const input = {
    data: {
      realtime: [
        { word: "正常热搜", rank: 1 },
        { word: "商业词条", rank: null, small_icon_desc: "商", dot_icon: 1 },
        { word: "辟谣词条", rank: null, small_icon_desc: "" },
        { word: "新词条", rank: 2, small_icon_desc: "新" },
      ],
      unrelatedCards: [
        { id: "business-category", small_icon_desc: "商" },
      ],
    },
  };
  const result = execute(JSON.stringify(input));
  const parsed = result.body ? JSON.parse(result.body) : input;

  assert.deepEqual(
    parsed.data.realtime.map((item) => item.word),
    ["正常热搜", "辟谣词条", "新词条"]
  );
  assert.deepEqual(parsed.data.unrelatedCards, [
    { id: "business-category", small_icon_desc: "商" },
  ]);
});

test("passes unrelated and malformed responses through unchanged", () => {
  const unrelated = execute(
    JSON.stringify({ ok: 1, data: { value: "normal" } })
  );
  const malformed = execute("not-json");

  assert.equal(Object.keys(unrelated).length, 0);
  assert.equal(Object.keys(malformed).length, 0);
});
