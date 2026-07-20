/**
 * 网页链接净化（Surge）
 *
 * 只删除明确的营销/分享追踪参数：
 * - utm_*
 * - spm / spm_id_from
 * - vd_source
 * - share_source / share_medium / share_plat / share_session_id /
 *   share_tag / share_from
 *
 * 登录令牌、签名、内容 ID、分页参数等其余字段原样保留。
 */

(function () {
  "use strict";

  var EXACT_TRACKING_PARAMETERS = {
    spm: true,
    spm_id_from: true,
    vd_source: true,
    share_source: true,
    share_medium: true,
    share_plat: true,
    share_session_id: true,
    share_tag: true,
    share_from: true,
  };

  function decodeParameterName(rawName) {
    try {
      return decodeURIComponent(rawName.replace(/\+/g, " ")).toLowerCase();
    } catch (_) {
      return rawName.toLowerCase();
    }
  }

  function isTrackingParameter(rawName) {
    var name = decodeParameterName(rawName);
    return name.indexOf("utm_") === 0 || EXACT_TRACKING_PARAMETERS[name] === true;
  }

  function cleanUrl(url) {
    if (typeof url !== "string" || url.length === 0) return url;

    var hashIndex = url.indexOf("#");
    var fragment = hashIndex === -1 ? "" : url.slice(hashIndex);
    var withoutFragment = hashIndex === -1 ? url : url.slice(0, hashIndex);
    var queryIndex = withoutFragment.indexOf("?");
    if (queryIndex === -1) return url;

    var base = withoutFragment.slice(0, queryIndex);
    var query = withoutFragment.slice(queryIndex + 1);
    if (!query) return url;

    var parts = query.split("&");
    var kept = [];
    var removed = 0;

    for (var index = 0; index < parts.length; index += 1) {
      var part = parts[index];
      var equalsIndex = part.indexOf("=");
      var rawName = equalsIndex === -1 ? part : part.slice(0, equalsIndex);

      if (isTrackingParameter(rawName)) {
        removed += 1;
      } else {
        kept.push(part);
      }
    }

    if (removed === 0) return url;
    return base + (kept.length > 0 ? "?" + kept.join("&") : "") + fragment;
  }

  var originalUrl = $request && $request.url;
  var cleanedUrl = cleanUrl(originalUrl);

  if (cleanedUrl && cleanedUrl !== originalUrl) {
    console.log("链接净化：已移除营销/分享追踪参数");
    $done({ url: cleanedUrl });
    return;
  }

  $done({});
})();
