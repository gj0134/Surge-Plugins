"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const harPath = path.join(root, "www.zhihu.com.har");
const script = fs.readFileSync(path.join(root, "Zhihu-Web-AdBlock.js"), "utf8");

function headersToObject(headers) {
  return Object.fromEntries(headers.map((header) => [header.name, header.value]));
}

function execute(entry) {
  let result;
  vm.runInNewContext(script, {
    $response: {
      headers: headersToObject(entry.response.headers),
      body: entry.response.content.text,
    },
    $done(value) {
      result = value;
    },
    console: { log() {} },
  });
  return result;
}

test(
  "removes every feed_advert item from the local Zhihu HAR",
  { skip: !fs.existsSync(harPath) },
  () => {
    const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
    const entries = har.log.entries.filter((entry) =>
      entry.request.url.startsWith(
        "https://www.zhihu.com/api/v3/feed/topstory/recommend"
      )
    );

    let advertisementsBefore = 0;
    let advertisementsAfter = 0;

    for (const entry of entries) {
      const before = JSON.parse(entry.response.content.text);
      advertisementsBefore += before.data.filter(
        (item) => item.type === "feed_advert"
      ).length;

      const result = execute(entry);
      const after = JSON.parse(result.body || entry.response.content.text);
      advertisementsAfter += after.data.filter(
        (item) => item.type === "feed_advert"
      ).length;
    }

    assert.equal(entries.length, 32);
    assert.equal(advertisementsBefore, 1);
    assert.equal(advertisementsAfter, 0);
  }
);

test(
  "injects the exact navigation selectors into the captured Zhihu HTML",
  { skip: !fs.existsSync(harPath) },
  () => {
    const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
    const entry = har.log.entries.find(
      (item) => item.request.url === "https://www.zhihu.com/hot"
    );

    assert.ok(entry);
    assert.match(entry.response.content.text, /www\.zhihu\.com\/project-square/);
    assert.match(entry.response.content.text, /www\.zhihu\.com\/fiore\/h5\/vip-web/);

    const result = execute(entry);
    assert.match(result.body, /surge-zhihu-web-adblock/);
    assert.match(
      result.body,
      /a\[href="https:\/\/www\.zhihu\.com\/project-square"\]/
    );
    assert.match(
      result.body,
      /a\[href="https:\/\/www\.zhihu\.com\/fiore\/h5\/vip-web"\]/
    );
    assert.match(result.body, /KfeCollection-CreateSaltCard/);
  }
);

test(
  "removes the moments ad without treating empty paid_info as paid content",
  { skip: !fs.existsSync(harPath) },
  () => {
    const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
    const entry = har.log.entries.find((item) =>
      /^https:\/\/www\.zhihu\.com\/api\/v3\/moments(?:\?|$)/.test(
        item.request.url
      )
    );

    assert.ok(entry);
    const before = JSON.parse(entry.response.content.text);
    const beforeAds = before.data.filter(
      (item) => item.type === "feed_advert"
    ).length;

    const result = execute(entry);
    const after = JSON.parse(result.body);
    const afterAds = after.data.filter(
      (item) => item.type === "feed_advert"
    ).length;

    assert.equal(beforeAds, 1);
    assert.equal(afterAds, 0);
    assert.ok(after.data.some((item) => item.target?.paid_info?.type === ""));
  }
);
