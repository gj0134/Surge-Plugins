# Surge 网页净化与开发辅助模块

## 模块列表

| 模块 | 作用 | 状态 |
| --- | --- | --- |
| 知乎网页净化 | 去广告、盐选/付费内容和顶部多余入口 | 可安装 |
| 网页链接净化 | 删除知乎、微博、B站链接中的营销与分享追踪参数 | 可安装 |
| 本地开发保护 | localhost、Docker/OrbStack、私网直连并绕过 MITM | 可安装 |
| 微博网页净化 | 信息流、个人主页和热搜广告，减少主页访问上报 | 可安装 |
| B站网页版净化 | 首页广告、赛事推广、直播推荐和右侧广告 | 等待目标页面 HAR |

## 网页链接净化

删除 `utm_*`、`spm`、`spm_id_from`、`vd_source` 和常见 `share_*` 追踪参数；令牌、签名、内容 ID 和其他业务参数不会被删除。当前只作用于知乎、微博和 B站网页域名，避免对所有 HTTPS 网站开启泛域名 MITM。

从 URL 安装：

```text
https://raw.githubusercontent.com/gj0134/Surge-Plugins/main/Link-Cleaner.sgmodule?v=1.0.0
```

## 本地开发保护

现有配置已经包含局域网直连规则时，本模块仍可补充 macOS 系统代理的 `skip-proxy`，并明确排除本地域名的 MITM。覆盖：

- `localhost`、`*.localhost`、`*.local`、`*.test`；
- Docker 与 OrbStack 常见本地主机名；
- IPv4 回环、链路本地和 RFC 1918 私网；
- IPv6 回环、链路本地和本地唯一区段。

从 URL 安装：

```text
https://raw.githubusercontent.com/gj0134/Surge-Plugins/main/Local-Dev-Protection.sgmodule?v=1.0.0
```

注意：`skip-proxy` 是 macOS“设置为系统代理”时的兼容性绕过项；若同时开启增强模式，流量仍可能进入 Surge 虚拟网卡，但会由模块顶部的 `DIRECT` 规则直连。

## 知乎网页净化

用于 Safari 等浏览器访问知乎网页版时：

- 屏蔽首页信息流、问题页首屏和常见侧栏广告；
- 过滤带明确付费标记的盐选、会员试读内容；
- 拒绝知乎广告曝光/点击统计请求；
- 隐藏顶部导航中的 `AI Works` 和`故事`；
- 保留关注、推荐、热榜、专栏、圈子及正常回答。

### 从 URL 安装

在 Surge 的模块页面选择“从 URL 安装”，粘贴：

```text
https://raw.githubusercontent.com/gj0134/Surge-Plugins/main/Zhihu-Web-AdBlock.sgmodule?v=2.0.1
```

启用模块后，确认 Surge 的「脚本」和「MITM」主开关已启用，并已在 macOS 中安装、信任 Surge 的 MITM 证书，然后重新载入知乎页面。模块只能把 `www.zhihu.com` 加入 MITM 主机名，不能替你打开全局 MITM 主开关。

### 本地安装

1. 把 `Zhihu-Web-AdBlock.sgmodule` 和 `Zhihu-Web-AdBlock.js` 一起放到 Surge 当前配置文件所在目录。
2. 在 Surge 的模块设置中添加并启用本地模块 `Zhihu-Web-AdBlock.sgmodule`。
3. 确认 Surge 的「脚本」和「MITM」功能已启用，并已在 macOS 中安装、信任 Surge 的 MITM 证书。
4. 重新载入知乎页面。

本地安装时也会从本仓库的 HTTPS Raw URL 加载脚本，因此只需要保留 `.sgmodule` 文件；如果需要完全离线使用，可把模块中的两处 `script-path` 改回同目录下的 `Zhihu-Web-AdBlock.js`。

## 微博网页净化

基于 `www.weibo.com.har` 中的真实网页接口：

- 过滤首页信息流和个人主页中标记为 `isAd` / `promotion` 的微博；
- 过滤热搜列表中标记为“商”的商业词条；
- 拒绝广告提示接口、微博页面行为/阅读时长上报和 RUM 遥测；
- 保留个人主页资料、微博内容、关注及互动功能所需接口。

从 URL 安装：

```text
https://raw.githubusercontent.com/gj0134/Surge-Plugins/main/Weibo-Web-AdBlock.sgmodule?v=1.0.0
```

“个人主页访问上报”只能做客户端尽力阻断：模块会阻止 HAR 中可见的行为、阅读时长和 RUM 请求，但如果微博服务器在返回主页资料时直接记录访问，本地模块无法保证完全消除。

## 验证

本地脚本测试：

```bash
node --test test/*.test.js
```

HAR 回归测试会在本地存在 `www.zhihu.com.har` 或 `www.weibo.com.har` 时运行；抓包文件由 `.gitignore` 排除，不会提交到仓库。

Surge 配置语法：

```bash
/Applications/Surge.app/Contents/Applications/surge-cli \
  --check test/Surge-Validation.conf

/Applications/Surge.app/Contents/Applications/surge-cli \
  --check test/Link-Cleaner-Validation.conf

/Applications/Surge.app/Contents/Applications/surge-cli \
  --check test/Local-Dev-Protection-Validation.conf

/Applications/Surge.app/Contents/Applications/surge-cli \
  --check test/Weibo-Validation.conf
```

`surge-cli --check` 只接受带 `FINAL` 规则的完整 Surge 配置，不能直接检查局部模块；`test/Surge-Validation.conf` 是专门用于校验相同规则、脚本和 MITM 字段的完整配置壳。
