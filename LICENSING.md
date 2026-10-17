# 许可核查记录

核查日期：2026-10-17。状态：**偕作BIM有权授权的新增及修改部分采用 MIT；完整衍生插件的上游授权依据仍待明确。**

## 本项目贡献的开源许可

偕作BIM拥有授权权利的原创新增及修改部分适用 [LICENSE](LICENSE) 中的 MIT License。允许使用、复制、修改、合并、发布、分发、再许可及商业使用，但须保留相应版权和许可声明；软件按现状提供，不附带保证。

MIT 授权仅覆盖维护者有权授权的贡献，不包含继承代码中的上游权利。第三方代码、依赖及带有 NocoBase 声明的文件继续受其各自适用条款约束。对于混合了上游代码的文件，不将整个文件直接视为 MIT 授权。

## 已核对的来源

- 原作者：**simousa**；原项目地址：[simousa/nocobase-plugin](https://github.com/simousa/nocobase-plugin)。
- 上游仓库：[simousa/nocobase-plugin](https://github.com/simousa/nocobase-plugin)。
- 上游插件：[plugin-custom-schema-uid](https://github.com/simousa/nocobase-plugin/tree/b2a60651ca579ab2aab990877cee641e34fde561/plugin-custom-schema-uid)，版本 `0.1.1`，提交 `b2a60651ca579ab2aab990877cee641e34fde561`。
- 固定提交的仓库根目录、插件根目录均未发现 LICENSE 文件，两个 README 未声明整体许可证，插件 package.json 未包含 license 字段。
- 部分继承文件带有 NocoBase 的版权及双重许可文件头，已原样保留。这些文件头不能据此推定整个上游插件均按同一许可证授权。

## 本次处理

保留原作者、上游仓库及固定提交；将偕作BIM标注为改进版维护者。LICENSE 同时说明授权范围并提供本项目贡献的 MIT 条款，不替原作者授权，也不将整个衍生插件标为 MIT。package.json 使用 `SEE LICENSE IN LICENSE` 指向范围说明；`x-upstream` 仅记录来源，不构成许可。

## 公开发布前需补齐

取得适用于本衍生版本的上游许可依据，记录具体许可证或授权的范围与证据；核对继承文件中的 NocoBase 声明所要求的条件。在依据明确后补充适用许可文件、包元数据和本记录，再执行 `node scripts/preflight.cjs --strict-public`。

当前预检查可以确认技术准备情况；不会将“仓库可访问”或“已经署名”等同于获得再分发授权。未向原作者发送消息或代替维护者接受任何协议。

判断依据参考 [GitHub 官方许可证说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)：公开仓库的查看／fork 与开源许可证授予的使用、修改和分发权利有不同含义。本记录只报告已核对的文件与待明确事项，不替权利人作许可声明。
