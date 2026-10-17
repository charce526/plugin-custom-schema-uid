# 验证记录

日期：2026-10-17（Asia/Shanghai）

当前版本：`@xiezuo/plugin-custom-schema-uid@1.1.0`。下述运行测试在 beta.2 完成；1.1.0 仅更新版本、包描述及发布文档，运行时代码未变，未重复执行数据库及浏览器测试。

## 已执行

| 环境 | 结果 | 验证范围 |
|---|---|---|
| 当前 NocoBase 2.2.10 依赖 + MariaDB | 16 组全部通过 | 真实 NocoBase Database、官方 Schema / FlowModel 仓储、官方路由定义、真实数据库事务与锁、管理列表排序及分组序列化 |
| 独立官方 NocoBase 2.2.0 服务端依赖 + MariaDB | 16 组全部通过 | 同一脚本切换至 2.2.0 的 database、utils、server、ACL、相关官方插件与仓储；使用应用已有 MariaDB 2.5.6 驱动 |
| 客户端回归 | 7 组全部通过 | V2 页签、两套菜单的 V1/V2 表单与创建生命周期、真实 FlowDefinition、树排序及筛选、中文注册、V1 配置映射、旧地址解析 |
| 官方构建 | 通过 | client、client-v2、server、完整 TypeScript 类型声明 |
| 本地开发实例启用 | 成功 | 普通 pm enable，同步插件自有表，无数据库重置 |
| 浏览器隔离验收 | 通过 | 中文页面、V1 修改完整交互、影响预览、勾选确认、最终确认、成功提示、V2 页面与默认页签 UID 创建 |

beta.1 浏览器测试使用同一管理组件、真实服务层和隔离 MariaDB 数据，截图位于 `storage/uid-management-verified.png`。

beta.2 另在当前已登录的 2.2.10 实例检查 `/admin` 的原生 V1、V2 新建页面窗口：均直接显示“自定义 UID”，输入后实时预览地址，最后取消；`/v/admin` 的原生“页面”创建窗口也已确认显示该字段及新版地址前缀。统一管理页验证了菜单顺序、嵌套分组、搜索保留祖先及中文影响预览，实际显示路由信息 1 条、V1 页面配置 1 条、V1 配置层级关系 541 条及数量含义说明；仅预览后取消，没有执行现有业务页面的 UID 修改。截图位于 `storage/uid-beta2-v1-create.png`、`storage/uid-beta2-v2-create.png`、`storage/uid-beta2-impact.png`。

## 数据库测试中的 16 组

1. UID 归一化、字符、长度和系统保留路径。
2. 类型明确的 UID 引用、完整 URL 路径段改写；脚本和任意文本保留并提示人工检查。
3. V1/V2 页面、默认页签和额外页签的原子创建。
4. V2 已有页签改名，保留模型、区块父节点、树关系、内容、路由 ID、角色关系；确认校验和幂等重试。
5. V1 已有页签改名，保留 Schema 树、属性名、区块、Schema 权限和服务端联动。
6. 页面独立改名、页面／页签旧地址兼容、旧 UID 写入拦截。
7. 改回原 UID 时保留首次改名后新增的配置。
8. 预览后配置被修改时拒绝执行。
9. 注入中途写入失败，路由、Schema／模型、树、兼容记录及执行状态整体回滚。
10. 两个操作争用同一个 UID 时只有一个成功；重复创建不能覆盖已有对象。
11. 状态查询等待正在执行的事务，避免把未提交状态误报成失败。
12. 孤立树节点标识不允许被新对象复用。
13. 管理接口限制 root；兼容解析要求登录。
14. 原生路由服务端钩子处理空格、非法输入，阻止直接更新已有 UID。
15. 原生 updateOrCreate 请求使用同一数据库锁，重名不能变成覆盖更新。
16. 管理清单保留官方排序、分组、嵌套父节点，并将仓储结果转换成有实际 ID 的普通记录。

所有数据库测试只创建本次 `uid_test_<进程号>_<时间戳>_` 前缀表，结束后清理。故障注入不是在已有业务表上执行。

## 重现

在项目根目录执行：

```powershell
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/test-client.cjs
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/test.cjs

$env:UID_RUNTIME_ROOT = (Resolve-Path 'storage/uid-runtime-2.2.0').Path
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/test.cjs
Remove-Item Env:UID_RUNTIME_ROOT
```

2.2.0 的隔离依赖保存在工作区 `storage/uid-runtime-2.2.0/node_modules`，不覆盖主项目依赖。测试驱动固定沿用应用的 `mariadb@2.5.6`；额外安装最新版 3.x 驱动会与该版本 Sequelize 的返回元数据处理不兼容，不用于本次兼容结论。

## 验证边界

- 2.2.0 的结论是服务端真实运行验证及客户端源码接口核对，未完成独立 2.2.0 整套应用的浏览器验收。
- 原生创建页面的表单显示和地址预览已在当前实例点击验收；前插／后插／组内新增、页签完整创建仍以客户端回归验证调用协议，未逐项完成浏览器点击验收。
- 未将 SQLite、PostgreSQL 和其他 2.x 版本写成已验证；1.1.0 保留这一验证边界。
- 外部系统、任意 JavaScript 和手工拼接 URL 需要人工检查。插件禁用后旧地址兼容停止，已修改的真实 UID 不自动恢复。
