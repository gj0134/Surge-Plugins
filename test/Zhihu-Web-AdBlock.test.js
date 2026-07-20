"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(
  path.join(__dirname, "..", "Zhihu-Web-AdBlock.js"),
  "utf8"
);

function execute(response) {
  let result;
  vm.runInNewContext(script, {
    $response: response,
    $done(value) {
      result = value;
    },
    console: { log() {} },
  });
  return result;
}

test("injects CSS for ads and the two unwanted top navigation links", () => {
  const input = "<!doctype html><html><head></head><body></body></html>";
  const output = execute({
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: input,
  });

  assert.match(output.body, /surge-zhihu-web-adblock/);
  assert.match(output.body, /project-square/);
  assert.match(output.body, /fiore\/h5\/vip-web/);
  assert.match(output.body, /TopstoryItem--advertCard/);
});

test("removes marked ads while preserving normal feed items", () => {
  const input = {
    data: [
      { type: "answer", target: { title: "正常回答" } },
      { type: "feed_advert", ad_info: { id: "ad-1" } },
      { type: "article", target: { title: "包含 ad 字样但不是广告" } },
    ],
  };
  const output = execute({
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const parsed = JSON.parse(output.body);

  assert.equal(parsed.data.length, 2);
  assert.equal(parsed.data[0].target.title, "正常回答");
  assert.equal(parsed.data[1].target.title, "包含 ad 字样但不是广告");
});

test("removes explicit paid content but preserves empty paid_info placeholders", () => {
  const input = {
    data: [
      {
        type: "feed",
        target: {
          title: "普通回答",
          paid_info: { type: "", content: "", has_purchased: null },
        },
      },
      {
        type: "feed",
        target: {
          title: "付费回答",
          paid_info: {
            type: "paid_answer",
            content: "trial",
            has_purchased: false,
          },
        },
      },
      { type: "feed", target: { title: "盐选卡片", business_type: "salt" } },
      { type: "feed", target: { title: "试读卡片", is_trial: true } },
    ],
  };
  const output = execute({
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const parsed = JSON.parse(output.body);

  assert.equal(parsed.data.length, 1);
  assert.equal(parsed.data[0].target.title, "普通回答");
});

test("passes unrelated responses through unchanged", () => {
  const output = execute({
    headers: { "content-type": "text/plain" },
    body: "ok",
  });

  // output 来自 vm 的独立 realm，避免直接比较对象原型。
  assert.equal(Object.keys(output).length, 0);
});
