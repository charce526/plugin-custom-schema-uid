# 开发说明

## 环境

本插件面向 NocoBase 2.x，目标最低版本 2.2.0。验证记录见 [VERIFICATION.md](VERIFICATION.md)。在已有 NocoBase 开发工程中使用，将本目录放到 `packages/plugins/@xiezuo/plugin-custom-schema-uid`；构建、类型声明和测试依赖由宿主工程提供。Node.js 版本还需满足所用 NocoBase 版本的要求。

不要在独立源码目录执行 `npm test` 并据此判断插件不可用；这里没有独立的依赖锁文件。使用 NocoBase 工程本身的锁文件安装依赖，不用本插件的空 dependencies 替代宿主环境。

## 验证

以下命令均从 NocoBase 工程根目录执行：

```powershell
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/preflight.cjs
yarn build @xiezuo/plugin-custom-schema-uid
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/test-client.cjs
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/test.cjs
```

数据库测试使用 MariaDB 和真实 NocoBase 仓储。在测试环境配置 `DB_DIALECT`、`DB_HOST`、`DB_PORT`、`DB_DATABASE`、`DB_USER`、`DB_PASSWORD`，可由宿主工程 `.env` 提供。测试仅创建、使用并清理 `uid_test_<进程号>_<时间戳>_` 前缀表；运行账号需要该测试库的建表和删表权限。不提交环境文件、连接串、日志或业务截图。

`UID_RUNTIME_ROOT` 可指定另一套 NocoBase 依赖目录以验证最低版本。脚本不是 SQLite／PostgreSQL 兼容性证明。

## 改动约定

- 保留 [UPSTREAM.md](UPSTREAM.md)、原作者署名及继承的版权声明。
- V1/V2 页面和页签必须保持路由、配置标识与层级关系一致，不通过删除再创建已有页面实现重命名。
- 涉及迁移时验证回滚、并发、幂等、过期预览和旧会话写入保护。
- 中文与英文语言包同步维护，发布说明只陈述实际验证过的范围。
- `fixture-ui.cjs` 是仅绑定回环地址的本地隔离验收服务，没有登录鉴权，不用于生产部署。结束时按 README 的方式停止并清理隔离表。

提交前执行 [PUBLISHING.md](PUBLISHING.md) 中的检查。完整应用中的账号、权限、业务数据不属于本插件源码。
