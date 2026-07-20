# 知乎网页净化（Surge）

用于 Safari 等浏览器访问知乎网页版时：

- 屏蔽首页信息流广告和常见侧栏广告；
- 拒绝知乎广告曝光/点击统计请求；
- 隐藏顶部导航中的 `AI Works` 和`故事`；
- 保留关注、推荐、热榜、专栏、圈子及正常回答。

## 从 URL 安装

在 Surge 的模块页面选择“从 URL 安装”，粘贴：

```text
https://raw.githubusercontent.com/gj0134/Surge-Plugins/main/Zhihu-Web-AdBlock.sgmodule
```

启用模块后，确认 Surge 的「脚本」和「MITM」功能已启用，并已在 macOS 中安装、信任 Surge 的 MITM 证书，然后重新载入知乎页面。

## 本地安装

1. 把 `Zhihu-Web-AdBlock.sgmodule` 和 `Zhihu-Web-AdBlock.js` 一起放到 Surge 当前配置文件所在目录。
2. 在 Surge 的模块设置中添加并启用本地模块 `Zhihu-Web-AdBlock.sgmodule`。
3. 确认 Surge 的「脚本」和「MITM」功能已启用，并已在 macOS 中安装、信任 Surge 的 MITM 证书。
4. 重新载入知乎页面。

本地安装时也会从本仓库的 HTTPS Raw URL 加载脚本，因此只需要保留 `.sgmodule` 文件；如果需要完全离线使用，可把模块中的两处 `script-path` 改回同目录下的 `Zhihu-Web-AdBlock.js`。

## 验证

本地脚本测试：

```bash
node --test test/Zhihu-Web-AdBlock.test.js
```

Surge 配置语法：

```bash
/Applications/Surge.app/Contents/Applications/surge-cli \
  --check test/Surge-Validation.conf
```

`surge-cli --check` 只接受带 `FINAL` 规则的完整 Surge 配置，不能直接检查局部模块；`test/Surge-Validation.conf` 是专门用于校验相同规则、脚本和 MITM 字段的完整配置壳。
