# 1.2.0 验证记录

日期：2026-10-18。包名：`@xiezuo/plugin-custom-schema-uid`。本次差异基线为 GitHub `main` 提交 `c9f11546b530ab21a2cc62bb323f8214034f9476`（1.1.0），已通过只读远程检查核对。

## 回归结果

| 检查 | 结果 | 实际覆盖范围 |
| --- | --- | --- |
| 客户端自动化 | 10 组通过 | V1/V2 创建、页面编辑 UID 标签与按钮、真实表单编译、官方窗口接入、父窗口实际层级、同窗确认与取消、语言切换、路由树、失联状态查询和成功后地址更新 |
| NocoBase 2.2.10 + MariaDB | 17 组通过 | 使用真实仓储，验证 V1/V2 页面与页签创建及重命名、内容和权限保留、事务回滚、并发、预览失效、幂等、ACL、旧会话保护及历史记录升级行为 |
| 独立 NocoBase 2.2.0 服务端依赖 + MariaDB | 17 组通过 | 使用同一组隔离数据库场景，验证最低服务端依赖；数据库驱动为宿主已有 MariaDB 2.5.6 |
| 完整构建 | 通过 | client、client-v2、server 及 TypeScript 声明 |
| 源码预检查 | 通过 | 原作者与链接、中英语言包一致、脚本语法、基础敏感信息扫描、提交范围 |
| 编译安装包 | 通过 | 仅包含运行产物和说明；检查压缩包内元数据、运行入口及 SHA-256 |

数据库测试只创建和清理 `uid_test_<进程号>_<时间戳>_` 前缀的隔离表，不改动现有业务表。两套服务端环境本轮均重新运行。

## 浏览器专项记录

2026-10-17 已按用户要求在本机 Edge、NocoBase 2.2.10 `/admin` 实测原生页面编辑入口：

- 复现旧确认窗口被遮挡，并确认页面曾从 14101 插件开发服务持续加载旧代码；重启该前端服务后加载新源码。
- 发现父编辑窗口实际层级为 5000，而官方窗口管理器默认只分配 1003；修复后 UID 窗口为 5100，位于父窗口前方。
- 实际输入新 UID，点击“继续”，核对确认内容清晰可见、按钮可操作。
- 点击“取消”后返回输入步骤、保留输入，显示“已取消保存”，没有保存失败错误。
- 测试仅生成预览并取消，未执行该业务页面的 UID 迁移。

专项修复后的窗口代码本轮保留；浏览器测试不替代数据库事务回归。本轮整理清除了未使用的联合提交接口、旧翻译和冲突文档，没有增加请求超时或超时提醒。

## 升级行为检查

- 1.1.0 的历史旧地址、连续重命名记录均不再产生跳转映射。
- 即便旧的已完成操作仍保存 `oldAddress: redirect`，1.2.0 的执行重试和状态查询也统一返回旧地址失效状态。
- 旧 UID 记录仍用于阻止旧会话误写和跨页面重用；同一页面改回原 UID 继续保留后续新增配置。
- 原生标题、图标按官方流程保存，UID 独立提交；预览和取消不会提交 UID。
- 未更改插件集合结构，不需要重置数据库或手动清理历史记录。

## 重现

以下命令从 NocoBase 宿主工程根目录运行；先完成构建。

```powershell
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/preflight.cjs
yarn build @xiezuo/plugin-custom-schema-uid
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/test-client.cjs
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/test.cjs

$env:UID_RUNTIME_ROOT = (Resolve-Path 'storage/uid-runtime-2.2.0').Path
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/test.cjs
Remove-Item Env:UID_RUNTIME_ROOT

node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/package.cjs
```

## 验证边界

- 2.2.0 为实际服务端依赖测试，未完成独立整套应用的浏览器验收。
- 本机浏览器专项为 2.2.10 `/admin`；不声明所有运行入口均完成视觉验收。
- SQLite、PostgreSQL 及其他 2.x 版本未列为实测通过。
- 不保证任意脚本、表达式、外部链接自动改写，仍需人工检查。
- 源码扫描为基础规则检查，不代表能够发现所有秘密或缺陷。
- 本文件记录 1.2.0 发布材料的验证范围，发行状态以 GitHub Releases 为准。上游许可依据的待明确状态见 LICENSING.md。
