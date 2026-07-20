/**
 * 微博网页净化脚本（Surge Mac）
 *
 * 规则来自 2026-07-20 的 www.weibo.com HAR：
 * - 首页信息流广告：数组项 isAd === 1/true，并通常带 promotion
 * - 个人主页推广微博：data.list[].isAd === true
 * - 热搜商业词条：data.realtime[].small_icon_desc === "商"
 */

(function () {
  "use strict";

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isTruthyAdFlag(value) {
    return value === true || value === 1 || value === "1";
  }

  function isFeedAdvertisement(value) {
    if (!isObject(value)) return false;
    if (isTruthyAdFlag(value.isAd) || isTruthyAdFlag(value.is_ad)) {
      return true;
    }

    return isObject(value.promotion) && Object.keys(value.promotion).length > 0;
  }

  function isCommercialHotSearch(value) {
    return (
      isObject(value) &&
      typeof value.small_icon_desc === "string" &&
      value.small_icon_desc.replace(/^\s+|\s+$/g, "") === "商"
    );
  }

  function cleanValue(value, stats, parentKey) {
    if (Array.isArray(value)) {
      var cleaned = [];
      for (var index = 0; index < value.length; index += 1) {
        var item = value[index];
        if (isFeedAdvertisement(item)) {
          stats.feedAdvertisements += 1;
          continue;
        }
        if (parentKey === "realtime" && isCommercialHotSearch(item)) {
          stats.hotSearchAdvertisements += 1;
          continue;
        }
        cleaned.push(cleanValue(item, stats, ""));
      }
      return cleaned;
    }

    if (!isObject(value)) return value;

    var keys = Object.keys(value);
    for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      var key = keys[keyIndex];
      value[key] = cleanValue(value[key], stats, key);
    }
    return value;
  }

  var body =
    $response && typeof $response.body === "string" ? $response.body : "";
  if (!body) {
    $done({});
    return;
  }

  try {
    var json = JSON.parse(body);
    var stats = { feedAdvertisements: 0, hotSearchAdvertisements: 0 };
    var cleanedJson = cleanValue(json, stats);
    var removed = stats.feedAdvertisements + stats.hotSearchAdvertisements;

    if (removed > 0) {
      console.log(
        "微博网页净化：移除信息流/主页广告 " +
          stats.feedAdvertisements +
          " 条，热搜广告 " +
          stats.hotSearchAdvertisements +
          " 条"
      );
      $done({ body: JSON.stringify(cleanedJson) });
      return;
    }
  } catch (error) {
    console.log("微博网页净化：JSON 解析失败，放行原响应");
  }

  $done({});
})();
