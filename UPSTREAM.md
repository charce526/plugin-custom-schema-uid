# 上游来源

- 仓库：https://github.com/simousa/nocobase-plugin
- 基础插件：https://github.com/simousa/nocobase-plugin/tree/main/plugin-custom-schema-uid
- 原包名：`@simo/plugin-custom-schema-uid`
- 原作者：`simousa`
- 基础版本：`0.1.1`
- 固定提交：`b2a60651ca579ab2aab990877cee641e34fde561`

本地改进版包名为 `@xiezuo/plugin-custom-schema-uid`，由偕作BIM维护。公开原作者署名统一为 **simousa**，原项目地址为 **https://github.com/simousa/nocobase-plugin**。原包名 `@simo/plugin-custom-schema-uid` 和原始 package.json 中的 author 字段 `@simo` 仅用于记录历史元数据，不作为公开作者署名，也不将本项目表述为原作者官方版本。

固定源码：[b2a60651ca579ab2aab990877cee641e34fde561](https://github.com/simousa/nocobase-plugin/tree/b2a60651ca579ab2aab990877cee641e34fde561/plugin-custom-schema-uid)。原始代码中的 NocoBase 版权声明保留。上游插件 package.json 未声明 license，本改进版不擅自替上游添加许可证。完整检查范围和发布前待办见 [LICENSING.md](LICENSING.md)。

改进范围：修复 V2 页签路由与模型 UID 一致性、共享表单变更和输入校验；加入 V1 创建适配、统一管理页、真实 UID 事务修改、核心关联同步、单次确认、并发及过期会话保护、中英文文案及可复现的隔离数据库测试。1.2.0 新增页面编辑快捷入口，修复表单解析和弹窗层级问题，并取消旧地址兼容跳转。

官方源码对照：

- https://github.com/nocobase/nocobase/tree/v2.2.0
- https://github.com/nocobase/nocobase/tree/v2.2.10
- 页面路由：`packages/plugins/@nocobase/plugin-client/src/server/server.ts`
- V1 Schema：`packages/plugins/@nocobase/plugin-ui-schema-storage/src/server/`
- V2 模型：`packages/plugins/@nocobase/plugin-flow-engine/src/server/`
- V2 创建入口：`packages/core/client-v2/src/flow/admin-shell/admin-layout/AdminLayoutMenuModels.tsx`
- 页签创建：`packages/core/client-v2/src/flow/models/base/PageModel/PageModel.tsx`
