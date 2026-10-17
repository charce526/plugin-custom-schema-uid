# 页面UID自定义

为 NocoBase 的 V1/V2 页面和页签设置易读的 UID，支持新建时自定义，也支持修改已有页面的 UID。

例如，将页面地址从 `/admin/random-page-id` 改为 `/admin/project-management`，继续使用原有页面内容和配置。

[下载 v1.1.0](https://github.com/charce526/plugin-custom-schema-uid/releases/tag/v1.1.0) · [更新日志](CHANGELOG.md) · [问题反馈](https://github.com/charce526/plugin-custom-schema-uid/issues)

## 主要功能

| 功能 | 说明 |
| --- | --- |
| 创建时自定义 UID | 新建页面或页签时填写 UID，留空则自动生成。 |
| 修改已有 UID | 修改已有页面或页签的实际 UID，保留原有区块、布局、排序和权限关联。 |
| 统一管理 | 按官方路由的顺序和层级显示分组、页面及页签，支持搜索、筛选、复制和打开地址。 |
| 修改前检查 | 展示影响范围和配置记录数量，经勾选及再次确认后执行。 |
| 旧地址兼容 | 插件启用期间，旧地址可以跳转到修改后的地址。 |

修改页面 UID 不会同时重命名下属页签。配置更新采用事务处理，失败时整体回滚，并提供重复请求、过期预览和旧会话保存保护。

## 适用环境

- **NocoBase：**目标最低版本为 2.2.0，适用于 2.x。
- **页面类型：**支持 V1、V2 页面及页签，可在同一实例中混合使用。
- **管理权限：**默认仅超级管理员 `root` 可使用统一管理功能。

已验证的版本、数据库及浏览器检查范围见 [验证记录](VERIFICATION.md)。

## 安装

从 [Releases](https://github.com/charce526/plugin-custom-schema-uid/releases) 下载 `plugin-custom-schema-uid-1.1.0.tgz`，通过 NocoBase 插件管理器安装并启用“页面UID自定义”。

请选择 `.tgz` 插件安装包；源码 ZIP 用于开发和查看代码。

## 使用

### 新建页面或页签

进入界面配置模式，在原生新建页面窗口中填写“自定义 UID”。页面创建支持前插、后插和组内新增；添加页签时也可指定 UID。留空时使用自动生成的标识。

也可以在插件设置中的“页面UID自定义”管理页创建页面或页签。

### 修改已有 UID

1. 打开“页面UID自定义”管理页，找到目标页面或页签。
2. 点击“修改 UID”，输入新 UID。
3. 点击“检查影响并继续”，核对修改对象、新地址及影响范围。
4. 勾选已了解影响，再次确认后执行。

影响预览中的数量表示**内部配置记录数**，不代表页面数、区块数或业务数据条数。预览本身不会修改页面，配置变化或预览过期后需要重新检查。

管理入口：

- V1：`/admin/settings/uid-management`
- V2：`/v/admin/settings/uid-management`

### UID 格式

长度为 1～64 个字符，允许英文字母、数字、下划线和连字符，不能以连字符开头。保存时去除首尾空格，并检查系统保留名称及已有标识占用情况。

## 使用注意

- 修改 UID 会改变访问地址。自定义脚本、表达式、收藏及外部系统链接仍需人工检查，不能保证全部自动更新。
- 禁用插件后，旧地址兼容停止；已经修改的实际 UID 不会自动恢复。
- 升级前备份应用，按普通插件升级流程操作，无需重置数据库。

## 开发

包名：`@xiezuo/plugin-custom-schema-uid`。

将源码放入 NocoBase 工程的 `packages/plugins/@xiezuo/plugin-custom-schema-uid`，使用宿主工程的依赖，在工程根目录执行：

```shell
yarn build @xiezuo/plugin-custom-schema-uid
yarn pm enable @xiezuo/plugin-custom-schema-uid
```

开发环境和测试方法见 [CONTRIBUTING.md](CONTRIBUTING.md)，构建打包及发布流程见 [PUBLISHING.md](PUBLISHING.md)。

## 来源与许可

本插件基于原作者 **simousa** 的 [nocobase-plugin](https://github.com/simousa/nocobase-plugin) 仓库中的 `plugin-custom-schema-uid` 改进，保留原作者署名及原有版权声明。固定版本与改动范围见 [UPSTREAM.md](UPSTREAM.md)。

本项目有权授权的原创新增及修改部分采用 **MIT License**。继承代码和第三方代码不由本许可重新授权，仍适用各自的授权条件。上游固定版本未声明整体许可证，完整衍生插件的分发依据仍需明确。详见 [LICENSE](LICENSE) 和 [许可说明](LICENSING.md)。
