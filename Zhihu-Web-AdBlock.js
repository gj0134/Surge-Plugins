/**
 * 知乎网页端净化脚本（Surge）
 *
 * 1. HTML 响应：注入 CSS，隐藏广告卡片、广告侧栏，以及 AI Works/故事入口。
 * 2. JSON 响应：从信息流数组中删除带明确广告标记的对象。
 */

(function () {
  "use strict";

  const STYLE_ID = "surge-zhihu-web-adblock";
  const AD_TYPE_PATTERN =
    /(^|[_-])(ad|ads|advert|advertisement|commercial|market_?card|promotion|sponsor)([_-]|$)/i;
  const AD_TRACKING_PATTERN =
    /(?:sugar\.zhihu\.com|zhihu-web-analytics\.zhihu\.com|\/commercial_api\/|glory_adreaper|ad_reaper)/i;

  const CSS = `
/* 顶部不需要的入口：AI Works、故事 */
a[href*="/project-square"],
a[href*="/fiore/h5/vip-web"] {
  display: none !important;
}

/* 知乎已有的广告语义类名与标记 */
.TopstoryItem--advertCard,
.TopstoryItem[class*="advert" i],
[class*="AdvertCard"],
[class*="Advertisement"],
[data-za-detail-view-path-module*="advert" i],
[data-za-detail-view-path-module*="commercial" i],
.CommercialQuestionTail {
  display: none !important;
}

/* 当前网页端真实出现的广告跳转/统计链接 */
.TopstoryItem:has(a[href*="sugar.zhihu.com/glory_adreaper"]),
.Card:has(a[href*="sugar.zhihu.com/glory_adreaper"]),
.Card:has(a[href*="click.aliyun.com/"]),
a[href*="sugar.zhihu.com/glory_adreaper"],
a[href*="volcengine.com/activity/ark"],
a[href*="isite.baidu.com/site/"],
a[href*="click.aliyun.com/"] {
  display: none !important;
}
`;

  function headerValue(headers, name) {
    if (!headers) return "";
    const expected = name.toLowerCase();
    const key = Object.keys(headers).find(
      (item) => item.toLowerCase() === expected
    );
    return key ? String(headers[key]) : "";
  }

  function hasMeaningfulValue(value) {
    if (value === null || value === undefined || value === false) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return Boolean(value);
  }

  function isAdvertisement(value, depth) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    if (
      value.is_ad === true ||
      value.is_advert === true ||
      value.is_advertisement === true ||
      value.is_commercial === true ||
      value.is_sponsored === true
    ) {
      return true;
    }

    const markerKeys = [
      "ad_info",
      "adjson",
      "advert",
      "advertisement",
      "commercial_info",
      "promotion_extra",
      "sponsor_info",
    ];

    if (markerKeys.some((key) => hasMeaningfulValue(value[key]))) {
      return true;
    }

    const typeKeys = [
      "type",
      "feed_type",
      "card_type",
      "target_type",
      "style_type",
      "slot_type",
      "business_type",
    ];

    if (
      typeKeys.some(
        (key) =>
          typeof value[key] === "string" && AD_TYPE_PATTERN.test(value[key])
      )
    ) {
      return true;
    }

    const labelKeys = ["label", "badge", "tag", "source_label"];
    if (
      labelKeys.some(
        (key) =>
          typeof value[key] === "string" &&
          /^(广告|推广|赞助)$/.test(value[key].trim())
      )
    ) {
      return true;
    }

    for (const [key, child] of Object.entries(value)) {
      if (
        typeof child === "string" &&
        /(url|track|impression|monitor)/i.test(key) &&
        AD_TRACKING_PATTERN.test(child)
      ) {
        return true;
      }
    }

    if (depth >= 3) return false;

    return Object.values(value).some(
      (child) =>
        child &&
        typeof child === "object" &&
        !Array.isArray(child) &&
        isAdvertisement(child, depth + 1)
    );
  }

  function sanitizeJson(value, stats) {
    if (Array.isArray(value)) {
      return value
        .filter((item) => {
          if (isAdvertisement(item, 0)) {
            stats.removed += 1;
            return false;
          }
          return true;
        })
        .map((item) => sanitizeJson(item, stats));
    }

    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        value[key] = sanitizeJson(value[key], stats);
      }
    }

    return value;
  }

  function injectStyle(html) {
    if (html.includes(`id="${STYLE_ID}"`)) return html;

    const style = `<style id="${STYLE_ID}">${CSS}</style>`;
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, `${style}</head>`);
    }
    return `${style}${html}`;
  }

  const body = typeof $response.body === "string" ? $response.body : "";
  if (!body) {
    $done({});
    return;
  }

  const contentType = headerValue($response.headers, "content-type");
  const trimmed = body.trimStart();

  if (/text\/html/i.test(contentType) || /^<!doctype\s+html|^<html/i.test(trimmed)) {
    const modified = injectStyle(body);
    console.log("知乎网页净化：已注入界面隐藏规则");
    $done({ body: modified });
    return;
  }

  if (
    /(?:application|text)\/json/i.test(contentType) ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    try {
      const json = JSON.parse(body);
      const stats = { removed: 0 };
      const sanitized = sanitizeJson(json, stats);

      if (stats.removed > 0) {
        console.log(`知乎网页净化：已移除 ${stats.removed} 个广告数据项`);
        $done({ body: JSON.stringify(sanitized) });
        return;
      }
    } catch (error) {
      console.log(`知乎网页净化：JSON 解析失败，保持原响应（${error.message}）`);
    }
  }

  $done({});
})();
