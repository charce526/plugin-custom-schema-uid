# GitHub 提交与发布准备

当前版本：`1.1.0`。技术检查与许可核查分别记录；当前公开发布的待办是 [LICENSING.md](LICENSING.md) 中的上游许可依据。

## 提交范围

提交本插件目录内的 `src/`、`scripts/`、`.github/`、包元数据、入口文件、忽略规则和文档。不提交整个 NocoBase 宿主工程、`.env*`、`node_modules/`、`dist/`、`storage/`、`release/`、运行日志、数据库、上传文件和实际业务验收截图。

源码检查和干净导出不依赖数据库。从 NocoBase 工程根目录执行：

```powershell
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/preflight.cjs
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/preflight.cjs --export
```

导出只复制明确允许的源码及文档，拒绝符号链接，并扫描常见密钥格式、硬编码凭据、环境文件及私有机器路径。扫描是基础检查，不替代人工审查。输出到插件的 `storage/github-ready/`，在干净目录初始化 `main` 分支并暂存文件，执行暂存区空白检查；不创建 commit 或 remote。同时生成独立源码压缩包、SHA-256 清单和检查报告；这些输出都在 Git 忽略范围内。

## 本地 Git 准备

导出的干净目录已初始化 Git 并暂存源码。可继续核对，不要将宿主工程整体初始化为待发布仓库：

```powershell
# 先进入预检查输出的干净源码目录
git diff --cached --check
git diff --cached --stat
```

初次提交说明建议：`feat: add V1/V2 page and tab UID management based on simousa plugin`。

本改进版仓库为 [charce526/plugin-custom-schema-uid](https://github.com/charce526/plugin-custom-schema-uid)，包元数据中的 repository、homepage 和 bugs 指向本项目；原作者信息单独保存在 `x-upstream` 中。源码导出脚本只生成本地材料，不执行远程提交或发行版发布。

## 完整验证与安装包

按 [CONTRIBUTING.md](CONTRIBUTING.md) 构建和运行测试后：

```powershell
node packages/plugins/@xiezuo/plugin-custom-schema-uid/scripts/package.cjs
```

源码压缩包用于 GitHub 源码审查，不能作为 NocoBase 安装包导入。安装包为 `release/plugin-custom-schema-uid-1.1.0.tgz`，应包含编译后的 client、client-v2、server 及类型声明；其 `.sha256` 用于校验。安装包不提交到源码分支，可在许可依据明确后作为 GitHub Release 附件。

## 公开发布前的最后检查

1. 补齐许可依据和许可文件，使用 `node scripts/preflight.cjs --strict-public` 检查；依据未明确时该命令会返回非零退出码。
2. 实际仓库链接、作者信息、上游固定提交和版本号准确，保留原作者 `simousa` 及上游链接。
3. `git diff --cached --check` 通过，暂存区只包含本插件源码和文档。
4. 发布说明采用 [RELEASE_NOTES.md](RELEASE_NOTES.md)，版本号采用 1.1.0，保留 2.2.0 浏览器验收及其他数据库的验证边界。
5. 重新导出最终源码，核对安装包清单和哈希后再发布。
