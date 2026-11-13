# Port Guard · 界面预览

这是 Port Guard 桌面端的界面。应用配置保存在本机 SQLite，“电脑原有规则”从本机 Rust 后端只读读取系统防火墙并分类展示。防火墙执行层与真实访问日志尚未接入，页面不加载防火墙规则或安装服务。

## 运行

界面使用 React 19、TypeScript、Vite 8、Tailwind CSS 4 和 Radix UI 原语（shadcn/ui 风格源码组件）。Vite 8 需要 Node.js 20.19 或更高版本；仓库提供了 `.nvmrc`（Node 24）。

```sh
cd ui
fnm use            # 或 nvm use
npm install
npm run dev        # 同时启动界面 :1420 与本机 API :1421
```

构建静态预览：

```sh
npm run build
npm run preview
```

## 页面

| 页面 | 路由 | 作用 |
| --- | --- | --- |
| 总览 | `#/overview` | 运行状态、受保护端口、按端口访问分布、最近拦截和最近操作 |
| 端口规则 | `#/rules` | 规则列表、搜索筛选、启停、编辑和删除 |
| 访问日志 | `#/access` | 过滤层访问记录、来源/端口/协议筛选、CSV 导出 |
| 操作日志 | `#/operations` | 规则与设置变更时间线、CSV 导出 |
| 设置 | `#/settings` | 网络与日志偏好、提醒、运行状态、数据维护 |

新建/编辑规则使用右侧抽屉，删除使用确认对话框。浏览器与 Tauri 共用 Rust/SQLite 后端。进入规则页默认展示电脑原有规则，自动选择 macOS PF/应用防火墙或 Windows 系统防火墙读取器；用途分类、来源筛选、搜索和分页均适用于只读系统快照。无法读取的来源明确显示错误，PF 配置文件不当作已生效规则。

## 技术结构

- **样式**：Tailwind CSS 4，设计令牌集中在 `src/index.css`；不维护第二套全局 CSS。
- **组件**：`src/components/ui/` 是可直接修改的 shadcn/ui 风格源码，交互原语来自 Radix UI。
- **状态**：Zustand 管理规则、操作日志与偏好；TanStack Query 负责 Tauri 启动时的 SQLite 水合、重试与加载/错误状态。
- **动画**：Motion 负责页面过渡、侧栏活动指示与保存条；同时遵守 `prefers-reduced-motion`。
- **图表**：Recharts 按端口展示样本放行/拦截分布，并按路由懒加载。
- **图标**：Lucide React。
- **反馈**：Sonner toast、Radix AlertDialog、内联表单校验与空状态。

## 文件

- `src/App.tsx`：路由、持久化编排、抽屉/对话框与页面组合。
- `src/pages/`：五个页面。
- `src/components/layout/`：侧栏、移动端头部与底部标签栏、加载骨架。
- `src/components/ui/`：Button、Card、Dialog/Sheet、AlertDialog、Switch、Tooltip、Input、Select、Skeleton。
- `src/components/shared/`：页头、状态徽标、分段控件、搜索框、访问分布图、空状态。
- `src/components/rules/rule-sheet.tsx`：规则编辑抽屉与地址校验。
- `src/store/app-store.ts`：Zustand 状态与操作日志。
- `src/hooks/`：哈希路由、桌面水合、焦点归还。
- `src/data.ts`：演示数据、地址规范化与导出工具。
- `preview/`：页面截图，供设计评审使用。

## 设计边界

- 状态类文案带有“设计预览”或“示例”标记，避免把静态演示误认为真实防护结果。
- 访问日志明确区分“过滤层放行”和“服务已响应”，拦截事件允许聚合计次。
- 规则编辑会提示同端口/协议冲突；从已启用规则中移除来源时，提示已有连接会被撤销。
- 设置页的“已保存”只在写入完成或本地预览写入后显示；写入失败会保留错误提示。
- 未配置端口不受本软件影响；停用或删除规则只撤除本软件施加的策略。

详细页面结构与待确认项见 [`../docs/界面设计.md`](../docs/界面设计.md)。
