# GitHub 自动发布

[Release 工作流](https://github.com/Fankly/port-guard/actions/workflows/release.yml) 在推送 `v*` 标签后，自动构建 Windows x64 NSIS 安装包、macOS Apple 芯片 DMG 和 macOS Intel DMG。三个平台测试、构建和产物检查全部成功后，创建 GitHub Release，附上安装包、`SHA256SUMS` 和自动生成的更新说明。

## 发布版本

先将需要发布的代码提交并推送到 GitHub，然后在该提交上创建版本标签。当前项目为桌面预览阶段，建议从预发布标签开始：

```sh
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

正式版本标签使用 `v0.1.0`、`v0.2.0` 等格式；`-beta.1`、`-rc.1` 等标签自动标记为 GitHub Pre-release。只有已提交且属于标签的代码会进入安装包，未提交的本地修改不会发布。

版本由标签决定，CI 在临时构建目录中同步 Tauri 配置、Rust 包版本及 npm 清单和锁文件，不自动提交版本变更。依赖保持锁定，安装包版本和设置页版本一致。

## 验证与重试

- 修改发布工作流或发布工具并推送到 `master`/`main`，或为这些文件打开 PR，会自动构建三个平台用于验证；不会创建 Release。
- 在 Actions → Release → Run workflow 中，留空 `tag` 可对选定分支构建安装包，完成后在该次运行的 Artifacts 下载，保留 14 天。
- 填写已存在的 `v*` 标签可发布该标签对应的精确提交；也可以在失败运行上选择 Re-run failed jobs。
- 上传阶段失败时只留下草稿，重试可补齐安装包。已公开的 Release 不覆盖，需要变更时使用新标签。

发布只使用 GitHub 自动提供的 `GITHUB_TOKEN`，工作流仅为发布 job 开启 `contents: write`，无需额外配置个人访问令牌。

目前安装包未配置代码签名和 macOS 公证；默认发布说明在 [`release-notes.md`](release-notes.md)，应随项目能力变化更新。
