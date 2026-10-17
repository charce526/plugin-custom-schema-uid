# 提交前检查结果

日期：2026-10-17。版本：`@xiezuo/plugin-custom-schema-uid@1.1.0`。

结论：**技术检查通过，已准备本地 Git 源码提交材料；公开发布前仍需明确上游许可依据。**

1.1.0 仅调整版本、插件描述和发布文档。本表中的运行测试及完整构建结果来自运行时代码相同的 beta.2；1.1.0 重新执行源码预检查、安装包及 Git 导出检查，未重复执行数据库或浏览器测试。

| 检查项 | 结果 |
| --- | --- |
| 来源与署名 | README、UPSTREAM、发布说明和包元数据保留原作者 `simousa`、上游链接、0.1.1 版本及固定提交 |
| 上游许可 | 固定提交的根目录、插件目录、两个 README 和 package.json 未声明整体许可证；详见 LICENSING.md |
| 继承声明 | 现存 NocoBase 版权及许可文件头保留，未自行套用整体 MIT／Apache 许可证 |
| 本项目贡献许可 | 偕作BIM有权授权的原创新增及修改部分采用 MIT；LICENSE 明确排除上游及第三方代码，包元数据指向该范围说明 |
| 源码清单 | 预检查只允许插件源码、脚本、入口、文档和仓库配置，不导出宿主工程 |
| 敏感信息基础扫描 | 允许提交的文件未发现所扫描的密钥格式、硬编码凭据或私有机器绝对路径；不表示可检测所有秘密 |
| 忽略规则 | 排除环境文件、日志、依赖、编译产物、运行存储、发布产物和本地截图 |
| 源码静态检查 | 中英语言包键一致、CommonJS 脚本语法通过、无检测到的合并冲突标记 |
| 客户端回归 | 7 组通过，包括实际 FlowDefinition 序列化、V1/V2 原生创建适配及层级筛选 |
| 当前服务端 | NocoBase 2.2.10 + MariaDB：16 组通过 |
| 最低服务端 | 独立 NocoBase 2.2.0 依赖 + MariaDB：16 组通过 |
| 完整构建 | client、client-v2、server 和 TypeScript 类型声明通过 |
| 安装包 | package.cjs 核对必要运行文件、原作者元数据、许可状态文档及敏感目录排除，生成 SHA-256 |

## 材料与发布状态

`PUBLISHING.md` 提供提交范围和操作步骤，`RELEASE_NOTES.md` 是可继续编辑的发布草稿。预检查的 `--export` 会生成独立的本地 Git 目录、源码 ZIP、清单和 JSON 报告，完成暂存及 `git diff --cached --check`，不创建 commit 或远程仓库。

本改进版仓库为 [charce526/plugin-custom-schema-uid](https://github.com/charce526/plugin-custom-schema-uid)，repository、homepage 和 bugs 指向本项目；上游信息单独保存在 `x-upstream` 中。检查结果不替代 LICENSING.md 所记录的许可范围及待明确事项。

## 验证边界

本轮数据库测试使用隔离前缀表，未改变现有业务页面的 UID。2.2.0 整套应用浏览器、其他数据库和其他 2.x 版本仍不列为实测通过。上轮浏览器验收范围见 `VERIFICATION.md`；业务截图留在忽略的本地存储中，不随源码或安装包发布。
