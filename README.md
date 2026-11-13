# port-guard

跨 Windows/macOS 的本机端口白名单工具。目前完成的是 **Mac PF 命令行技术原型 + Tauri 2 桌面预览壳**，还不是桌面安装版。

## 当前能力

- 将端口、TCP/UDP、多个 IP/CIDR 编译为独立 PF anchor 内容。
- 同时生成 IPv4、IPv6 规则；配置端口的反向流量也参与实验规则匹配。
- 调用本机 `pfctl -n` 检查语法，不加载规则。
- 生成限定来源 IP、本机 IP、协议和端口的双向状态清理请求；指定接口用于核对本机地址，默认只预览。
- 提供明确标记的实验性 `DIOCKILLSTATES` 调用，用于具备管理员授权的实验机。
- 解析 Darwin PFLOG 的真实 action、地址、端口和规则信息；拒绝把普通网卡抓包当成防火墙日志。
- 从已存在的 pflog 接口读取元数据；支持离线 classic pcap 解码。
- 提供双端口 TCP 和单向 UDP 测试工具。
- 提供 Tauri 2 桌面壳：React 界面通过受限 IPC 读写本机 SQLite，并由 Rust 侧复用规则校验；浏览器预览仍可独立运行。

尚未完成系统规则挂载安装器、后台常驻服务、Windows 执行层和实机流量验收。原型有意不提供自动启用 PF、全量加载主规则集或全量清理状态的命令。不能仅凭语法检查或 ioctl 返回成功就宣布访问权限已撤销。

## 界面设计预览

`ui/` 是 React + TypeScript 的界面（Tailwind CSS 4 + Radix UI/shadcn 风格组件 + Motion + Zustand + TanStack Query + Recharts），包含总览、端口规则、访问日志、操作日志、设置五个页面和规则编辑抽屉。在浏览器中独立运行时只读写 `localStorage` 中的演示数据；在 Tauri 桌面端则通过 IPC 读写本机 SQLite。

```sh
cd ui
npm install
npm run dev    # http://127.0.0.1:1420
```

需要 Node.js 20.19+（仓库提供 `ui/.nvmrc`，当前为 Node 24）。设计说明、页面截图和待确认项见 [`docs/界面设计.md`](docs/界面设计.md)。

## 桌面端（Tauri 2 + SQLite）

`src-tauri/` 按 [`docs/技术选型与验证计划.md`](docs/技术选型与验证计划.md) 的技术方向搭建，当前只覆盖桌面壳和本地存储：

- React/TypeScript 界面运行在系统 WebView 中，浏览器预览仍可独立使用。
- Rust 命令层调用 `pf-probe` 的规则核心重新校验端口、协议和 IP/CIDR，再写入 SQLite（rusqlite）；前端不能绕过校验。
- 规则核心的 `render`/`preview_policy` 仍只生成独立的 anchor 预览，**不加载规则、不启用 PF、不请求管理员权限**（当前由 Rust 测试覆盖，尚未接到界面按钮）。
- 后台服务、LaunchDaemon、PF 实际挂载、Windows WFP、真实日志和安装包仍未实现。

前后台 IPC 契约、联调步骤与本轮验收结果见 [`docs/前后台联调.md`](docs/前后台联调.md)。

### Windows 现状

- 预览包（界面 + SQLite）通过 `.github/workflows/windows-build.yml` 在 `windows-latest` 上构建；每次 push/PR 运行 `cargo test --workspace`，安装包只在手动触发时用 `--bundles nsis` 产出。产物不包含 WFP 执行层，因此不会拦截任何流量。
- `doctor`、`check`、`plan-update`、`kill` 只在 macOS 可用；在 Windows 上执行会返回明确的“仅 macOS”错误，而不是找不到 `pfctl` 的模糊失败。`render`、`decode` 和桌面壳在各平台都可用。
- 界面的设备名、引擎名、日志源与首次演示数据按平台渲染：Windows 显示 `WFP` / `WFP 事件` / “这台 PC”，macOS 显示 `PF` / `PF 日志` / “这台 Mac”。
- `bundle.targets` 为 `all`，Windows 安装器使用 `embedBootstrapper`（未内嵌 WebView2 离线包，目标机缺少 WebView2 时需要联网）。产物未做代码签名，Windows 会提示 SmartScreen“未知发布者”。

首次准备与启动：

```sh
npm install                  # 安装 Tauri CLI
npm --prefix ui install      # 安装界面依赖
python3 tools/desktop.py dev # 启动桌面窗口；需要 Node.js >= 20.19
```

构建前端和桌面二进制：

```sh
npm --prefix ui run build
python3 tools/desktop.py build --no-bundle
```

`tools/desktop.py` 与 `tools/dev.py` 共用 `.local-toolchain.json` 的本地 Rust 工具链配置。SQLite 文件位于系统应用数据目录，实际路径显示在设置页“运行状态”中；删除它等同于清空本机预览数据。

## 开发

要求：macOS、Command Line Tools、Rust 1.99.1、Python 3。Rust 版本在 `rust-toolchain.toml` 固定，依赖在 `Cargo.lock` 固定。

普通环境可直接执行：

```sh
cargo test
cargo build
python3 -m unittest discover -s tests -v
```

当前机器使用工作目录内安装的 Rust，不修改全局环境。`.local-toolchain.json` 记录本机位置，已被 Git 忽略：

```sh
python3 tools/dev.py test
python3 tools/dev.py build
python3 tools/dev.py test -p port-guard-desktop
python3 -m unittest discover -s tests -v
```

换机器时可以使用自己的 Cargo，或通过 `PORT_GUARD_TOOLCHAIN` 指定包含 `cargo/` 和 `rustup/` 的本地工具链目录。

## 无系统修改的运行方式

当前机器已生成 `dist/macos-arm64/pf-probe`，可以直接运行 `./dist/macos-arm64/pf-probe doctor`。这是在本机编译的 Apple 芯片命令行程序，不是通用安装包，也不表示 Intel 或其他系统版本已通过实测。

示例中的 `192.0.2.*`、`2001:db8::*` 是文档地址。`18080` 为实验受管端口，`18081` 为对照端口；实际网页服务的 `8080` 可以之后作为另一份策略配置。

```sh
python3 tools/dev.py run -- doctor
python3 tools/dev.py run -- render --policy examples/policy.json
python3 tools/dev.py run -- check --policy examples/policy.json
python3 tools/dev.py run -- kill --source 192.0.2.20 --local 192.0.2.10 --port 18080 --protocol tcp --interface en0
```

`render` 输出的是 **anchor 内容**，不是主规则集。若指定 `--out`，目标文件必须不存在，防止覆盖已有配置。

`doctor` 区分 `/etc/pf.conf` 源文件与内核中的实际规则。普通用户无法读取 `/dev/pf` 是系统权限结果，不代表生成器或解析器失败。

## 实验性状态清理

`kill` 默认返回 JSON 预览和请求字节，完全不访问 PF 写接口。真正调用 ioctl 必须同时提供 `--execute` 和 `--experimental-abi`，并由管理员运行已编译的二进制。

这条实验路径要求：

1. 在可恢复的实验机上审查生成规则、实际 root anchor 位置及已有规则。
2. 先应用并验证只针对实验端口的阻断策略。仅清理状态可能让连接重新通过，不能当作防火墙策略。
3. 本机 IP 必须属于指定接口；来源必须是单个具体 IP，不能是网段或 `any`。
4. 显式填写当前 `uname -r`，避免旧命令在系统升级后误执行。该参数只是实验确认，**不是 ABI 已验证的证明**。
5. 同时观察受管端口和对照端口的数据；ioctl 成功与流量被阻断分别记录。

源码采用 216 字节请求布局，并有编译期偏移断言；结构来源见 `SOURCES.md`。运行时兼容性尚未验证，当前不承诺所有 macOS 版本均能使用。

实验会分别匹配“远端到本地服务”及“本地服务到远端”的原始状态方向。状态接口过滤字段保持为空，以覆盖原先的 floating state；精确地址、协议和本地服务端口在两次请求中始终保留。两次 ioctl 不是一个原子事务，任一步失败都需要重新核验状态。

目前实验性撤权拒绝 IPv6 link-local 地址，因为它们还需要可靠的接口 scope 区分；完整 IPv6 兼容性仍是后续验收项。规则生成和日志解析本身支持 IPv6。

先在普通用户环境构建程序，再对必要的诊断/实验命令授权。不要用 `sudo cargo` 构建第三方依赖。

## PF 日志

离线：

```sh
python3 tools/dev.py run -- decode --pcap capture.pcap
```

读取已经正确配置的 pflog 接口时，运行已编译的 `pf-probe capture --interface pflog7 --port 18080 --seconds 10`。这通常需要管理员授权。该命令不创建接口、不修改 PF 规则、不保存包内容，标准输出为元数据 JSONL，标准错误输出为采集统计。

解析器拒绝普通 Ethernet pcap、未知 action，以及无法安全取出端口的非首片分片。截断或不支持的事件会被统计，不能冒充“没有访问”。本软件的 allow 事件只证明相应 PF 过滤裁决，不证明网页已响应或其他过滤层也放行。

## 双机验证工具

服务端在 Mac 上启动，`MAC_LAN_IP` 替换为这台 Mac 的真实地址：

```sh
python3 tools/traffic_lab.py server --bind MAC_LAN_IP --seconds 300
```

另一个获授权的局域网设备安装 Python 3 并运行同一脚本：

```sh
python3 tools/traffic_lab.py observe --host MAC_LAN_IP --seconds 120
```

观察器一次建立两条 TCP 连接，并只发一次请求启动 UDP 下行流。它每秒输出各通道接收数量；不会把网络计数直接称为防火墙结果。手动规则实验、日志和观察记录需要相互核对。

完整步骤与未通过的门槛见 `docs/P0-实验流程.md`。当前无法进行内网双机测试，自动测试只验证工具本身的回环通信。

## 文件组织

- `src/policy.rs`：策略校验与规则生成。
- `src/native.rs`、`native/pf_native.c`：精确状态清理请求及实验接口。
- `src/pflog.rs`、`src/capture.rs`：PFLOG 解码与有界实时采集。
- `src/main.rs`：命令行入口。
- `src-tauri/`：Tauri 2 桌面壳、IPC 命令与 SQLite 存储。
- `ui/`：桌面界面（React + Vite + Tailwind CSS + Radix UI）；`ui/src/bridge.ts` 是浏览器预览与 Tauri IPC 的切换层。
- `tests/`：CLI、合成日志与测试工具回环验证。
- `tools/`：构建入口、桌面端入口、双机测试工具、只读管理员诊断脚本。
- `docs/`：需求规格、技术选型、界面设计及验收记录。
