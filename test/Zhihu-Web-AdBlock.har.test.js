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

function readInitialData(html) {
  const match = html.match(
    /<script\b[^>]*\bid=["']js-initialData["'][^>]*>([\s\S]*?)<\/script>/i
  );
  return match ? JSON.parse(match[1]) : null;
}

function getQuestionAdvertisements(initialData) {
  return initialData?.initialState?.question?.adverts;
}

test(
  "removes every feed_advert item from the local Zhihu HAR",
  { skip: !fs.existsSync(harPath) },
  (t) => {
    const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
    const entries = har.log.entries.filter((entry) =>
      entry.request.url.startsWith(
        "https://www.zhihu.com/api/v3/feed/topstory/recommend"
      )
    );

    if (entries.length === 0) {
      t.skip("local HAR has no topstory recommendation response");
      return;
    }

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

    if (advertisementsBefore === 0) {
      t.skip("local HAR has no feed_advert fixture");
      return;
    }

    assert.equal(advertisementsAfter, 0);
  }
);

test(
  "injects the exact navigation selectors into the captured Zhihu HTML",
  { skip: !fs.existsSync(harPath) },
  (t) => {
    const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
    const entry = har.log.entries.find(
      (item) => item.request.url === "https://www.zhihu.com/hot"
    );

    if (!entry) {
      t.skip("local HAR has no Zhihu hot-page HTML");
      return;
    }
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
  (t) => {
    const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
    const entry = har.log.entries.find((item) =>
      /^https:\/\/www\.zhihu\.com\/api\/v3\/moments(?:\/[^?]*)?(?:\?|$)/.test(
        item.request.url
      )
    );

    if (!entry) {
      t.skip("local HAR has no moments response");
      return;
    }
    const before = JSON.parse(entry.response.content.text);
    const beforeAds = before.data.filter(
      (item) => item.type === "feed_advert"
    ).length;

    if (beforeAds === 0) {
      t.skip("local HAR moments response has no feed_advert fixture");
      return;
    }

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

test(
  "removes question-page advertisements embedded in the local Zhihu HAR",
  { skip: !fs.existsSync(harPath) },
  (t) => {
    const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
    const entry = har.log.entries.find((item) => {
      if (!/^https:\/\/www\.zhihu\.com\/question\//.test(item.request.url)) {
        return false;
      }

      const initialData = readInitialData(item.response.content.text || "");
      const advertisements = getQuestionAdvertisements(initialData);
      return (
        advertisements &&
        typeof advertisements === "object" &&
        Object.keys(advertisements).length > 0
      );
    });

    if (!entry) {
      t.skip("local HAR has no question-page advertisement fixture");
      return;
    }

    const before = readInitialData(entry.response.content.text);
    const advertisementsBefore = getQuestionAdvertisements(before);
    const advertisementTitles = Object.values(advertisementsBefore).flatMap(
      (item) => item?.ad?.creatives?.map((creative) => creative.title) || []
    );

    const result = execute(entry);
    const after = readInitialData(result.body);

    assert.ok(Object.keys(advertisementsBefore).length > 0);
    assert.deepEqual(getQuestionAdvertisements(after), {});
    assert.ok(advertisementTitles.length > 0);
    for (const title of advertisementTitles) {
      assert.equal(result.body.includes(title), false);
    }
    assert.match(result.body, /surge-zhihu-web-adblock/);
  }
);
