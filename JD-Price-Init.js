// Keep only device and client metadata consumed by the historical-price API.
const permitted = new Set([
  "c_mmbDevId", "c_appver", "c_appversion", "c_platform", "c_ostype",
  "c_osver", "c_devmodel", "c_brand", "c_channel", "c_devid",
]);
const fields = ($request.body || "").split("&").filter(field =>
  permitted.has(field.split("=", 1)[0])
);
if (fields.some(field => /^c_mmbDevId=.+/.test(field))) {
  if ($persistentStore.write(fields.join("&"), "manmanbuy_val")) {
    $notification.post("京东比价", "慢慢买参数已就绪", "");
  }
}
$done({});
