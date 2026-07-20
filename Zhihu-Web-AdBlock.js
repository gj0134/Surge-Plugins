/**
 * 知乎网页净化脚本（Surge Mac）
 *
 * 规则来自 2026-07-20 的知乎网页 HAR：
 * - 首页推荐接口：/api/v3/feed/topstory/recommend
 * - 广告项：data[].type === "feed_advert"
 * - 问题页首屏广告：initialState.question.adverts
 * - 关注信息流：/api/v3/moments
 * - 普通回答也会带空 paid_info，只有非空付费标记才视为盐选内容
 * - 顶部入口：/project-square、/fiore/h5/vip-web
 */

(function () {
  "use strict";

  var STYLE_ID = "surge-zhihu-web-adblock";
  var CSS = [
    "/* 隐藏顶部 AI Works 和故事入口（HAR 中的真实链接） */",
    'a[href="https://www.zhihu.com/project-square"],',
    'a[href="/project-square"],',
    'a[href="https://www.zhihu.com/fiore/h5/vip-web"],',
    'a[href="/fiore/h5/vip-web"] {',
    "  display: none !important;",
    "}",
    "",
    "/* 兼容首屏服务端渲染及知乎历史广告卡片 */",
    ".TopstoryItem--advertCard,",
    '[data-za-detail-view-path-module="AdItem"],',
    '[data-za-detail-view-path-module="AdvertItem"],',
    '.Card:has(a[href*="click.aliyun.com/"]),',
    'a[href*="sugar.zhihu.com/glory_adreaper"],',
    'a[href*="click.aliyun.com/"] {',
    "  display: none !important;",
    "}",
    "",
    "/* HAR 中的盐言作者平台侧栏 */",
    ".KfeCollection-CreateSaltCard {",
    "  display: none !important;",
    "}",
  ].join("\n");

  function getHeader(headers, expectedName) {
    if (!headers) return "";

    var expected = expectedName.toLowerCase();
    var keys = Object.keys(headers);
    for (var index = 0; index < keys.length; index += 1) {
      var key = keys[index];
      if (key.toLowerCase() === expected) return String(headers[key]);
    }
    return "";
  }

  function injectStyle(html) {
    if (html.indexOf('id="' + STYLE_ID + '"') !== -1) return html;

    var style = '<style id="' + STYLE_ID + '">' + CSS + "</style>";
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, style + "</head>");
    }
    return style + html;
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function stringifyForHtmlScript(value) {
    return JSON.stringify(value)
      .replace(/&/g, "\\u0026")
      .replace(/</g, "\\u003C")
      .replace(/>/g, "\\u003E")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  function cleanQuestionAdvertisements(html, stats) {
    var initialDataPattern =
      /(<script\b[^>]*\bid=["']js-initialData["'][^>]*>)([\s\S]*?)(<\/script>)/i;

    return html.replace(initialDataPattern, function (
      original,
      openingTag,
      jsonText,
      closingTag
    ) {
      try {
        var initialData = JSON.parse(jsonText);
        var initialState = initialData && initialData.initialState;
        var question = initialState && initialState.question;
        var advertisements = question && question.adverts;

        if (
          advertisements === null ||
          typeof advertisements !== "object"
        ) {
          return original;
        }

        var advertisementCount = Array.isArray(advertisements)
          ? advertisements.length
          : Object.keys(advertisements).length;
        if (advertisementCount === 0) return original;

        question.adverts = Array.isArray(advertisements) ? [] : {};
        stats.questionAdvertisements += advertisementCount;

        return (
          openingTag +
          stringifyForHtmlScript(initialData) +
          closingTag
        );
      } catch (error) {
        console.log("知乎网页净化：问题页初始数据解析失败，仅注入隐藏样式");
        return original;
      }
    });
  }

  function hasMeaningfulPaidInfo(object) {
    if (!isObject(object.paid_info)) return false;

    var paidInfo = object.paid_info;
    return Boolean(
      paidInfo.type ||
        paidInfo.content ||
        paidInfo.title ||
        paidInfo.id ||
        paidInfo.need_pay === true ||
        paidInfo.is_trial === true ||
        paidInfo.has_purchased === true
    );
  }

  function hasPaidMarker(object) {
    if (!isObject(object)) return false;
    if (
      object.is_paid === true ||
      object.is_trial === true ||
      object.need_pay === true ||
      hasMeaningfulPaidInfo(object)
    ) {
      return true;
    }

    var paidPattern = /paid|vip|salt|market|ebook/i;
    if (
      typeof object.business_type === "string" &&
      paidPattern.test(object.business_type)
    ) {
      return true;
    }
    if (
      typeof object.card_type === "string" &&
      paidPattern.test(object.card_type)
    ) {
      return true;
    }
    if (Array.isArray(object.biz_type_list)) {
      return object.biz_type_list.some(function (value) {
        return typeof value === "string" && paidPattern.test(value);
      });
    }
    return false;
  }

  function containsPaidMarker(value) {
    var stack = [value];

    while (stack.length > 0) {
      var current = stack.pop();
      if (Array.isArray(current)) {
        for (var arrayIndex = 0; arrayIndex < current.length; arrayIndex += 1) {
          if (current[arrayIndex] !== null && typeof current[arrayIndex] === "object") {
            stack.push(current[arrayIndex]);
          }
        }
        continue;
      }
      if (!isObject(current)) continue;
      if (hasPaidMarker(current)) return true;

      var keys = Object.keys(current);
      for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        var child = current[keys[keyIndex]];
        if (child !== null && typeof child === "object") stack.push(child);
      }
    }

    try {
      return JSON.stringify(value).indexOf("盐选推荐") !== -1;
    } catch (_) {
      return false;
    }
  }

  function filterItems(items, stats) {
    if (!Array.isArray(items)) return items;

    return items.filter(function (item) {
      if (!isObject(item)) return true;

      if (item.type === "feed_advert") {
        stats.advertisements += 1;
        return false;
      }

      if (item.type === "feed_group" && Array.isArray(item.list)) {
        item.list = filterItems(item.list, stats);
        return item.list.length > 0;
      }

      if (containsPaidMarker(item)) {
        stats.paid += 1;
        return false;
      }

      return true;
    });
  }

  function cleanFeedResponse(json) {
    var stats = { advertisements: 0, paid: 0 };
    if (!json || !Array.isArray(json.data)) return stats;

    json.data = filterItems(json.data, stats);
    return stats;
  }

  var body =
    $response && typeof $response.body === "string" ? $response.body : "";
  if (!body) {
    $done({});
    return;
  }

  var contentType = getHeader($response.headers, "content-type");
  var trimmed = body.replace(/^\s+/, "");

  if (/text\/html/i.test(contentType) || /^<!doctype\s+html|^<html/i.test(trimmed)) {
    var htmlStats = { questionAdvertisements: 0 };
    var cleanedHtml = cleanQuestionAdvertisements(body, htmlStats);
    if (htmlStats.questionAdvertisements > 0) {
      console.log(
        "知乎网页净化：移除问题页广告 " +
          htmlStats.questionAdvertisements +
          " 条"
      );
    }
    $done({ body: injectStyle(cleanedHtml) });
    return;
  }

  if (
    /(?:application|text)\/json/i.test(contentType) ||
    trimmed.charAt(0) === "{"
  ) {
    try {
      var json = JSON.parse(body);
      var stats = cleanFeedResponse(json);
      var removed = stats.advertisements + stats.paid;
      if (removed > 0) {
        console.log(
          "知乎网页净化：移除广告 " +
            stats.advertisements +
            " 条，盐选/付费 " +
            stats.paid +
            " 条"
        );
        $done({ body: JSON.stringify(json) });
        return;
      }
    } catch (error) {
      console.log("知乎网页净化：JSON 解析失败，放行原响应");
    }
  }

  $done({});
})();
