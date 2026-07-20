"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const harPath = path.join(root, "www.weibo.com.har");
const script = fs.readFileSync(path.join(root, "Weibo-Web-AdBlock.js"), "utf8");

function responseBody(entry) {
  const text = entry.response.content.text || "";
  return entry.response.content.encoding === "base64"
    ? Buffer.from(text, "base64").toString("utf8")
    : text;
}

function execute(entry) {
  let result;
  vm.runInNewContext(script, {
    $response: { body: responseBody(entry) },
    $done(value) {
      result = value;
    },
    console: { log() {} },
  });
  return result;
}

function endpoint(entry) {
  return new URL(entry.request.url).pathname;
}

function countFeedAds(value) {
  let count = 0;
  function visit(current) {
    if (!current || typeof current !== "object") return;
    if (!Array.isArray(current) && [true, 1, "1"].includes(current.isAd)) {
      count += 1;
    }
    if (Array.isArray(current)) current.forEach(visit);
    else Object.values(current).forEach(visit);
  }
  visit(value);
  return count;
}

function countCommercialHotSearches(value) {
  let count = 0;
  function visit(current) {
    if (!current || typeof current !== "object") return;
    if (!Array.isArray(current) && current.small_icon_desc === "商") {
      count += 1;
    }
    if (Array.isArray(current)) current.forEach(visit);
    else Object.values(current).forEach(visit);
  }
  visit(value);
  return count;
}

test(
  "removes every captured timeline and profile feed ad",
  { skip: !fs.existsSync(harPath) },
  (t) => {
    const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
    const entries = har.log.entries.filter((entry) =>
      ["/ajax/feed/unreadfriendstimeline", "/ajax/statuses/mymblog"].includes(
        endpoint(entry)
      )
    );

    let before = 0;
    let after = 0;
    for (const entry of entries) {
      const original = JSON.parse(responseBody(entry));
      before += countFeedAds(original);
      const result = execute(entry);
      after += countFeedAds(JSON.parse(result.body || responseBody(entry)));
    }

    if (before === 0) {
      t.skip("local HAR has no marked Weibo feed ads");
      return;
    }
    assert.ok(entries.length > 0);
    assert.equal(after, 0);
  }
);

test(
  "removes every captured commercial hot-search entry",
  { skip: !fs.existsSync(harPath) },
  (t) => {
    const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
    const entries = har.log.entries.filter((entry) =>
      ["/ajax/side/bandUnified", "/ajax/statuses/mineBand"].includes(
        endpoint(entry)
      )
    );

    let before = 0;
    let after = 0;
    for (const entry of entries) {
      const original = JSON.parse(responseBody(entry));
      before += countCommercialHotSearches(original);
      const result = execute(entry);
      after += countCommercialHotSearches(
        JSON.parse(result.body || responseBody(entry))
      );
    }

    if (before === 0) {
      t.skip("local HAR has no commercial hot-search fixture");
      return;
    }
    assert.ok(entries.length > 0);
    assert.equal(after, 0);
  }
);
