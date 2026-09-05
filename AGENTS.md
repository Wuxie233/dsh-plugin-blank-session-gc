## dsh-std 集成约定（优先于下文旧部署说明）

- 当前入口是标准 facet，不再是 Cordis 插件；业务在 lib/host.js 的 createHost(api)。
- 原生 @deepseek-ai 导入只允许集中在同级 dsh-std/packages/adapter-dsh；插件通过 api 获取。
- session snapshots/read 和 Web composer 适配优先复用 adapter helper，未知日志 API 必须报错，不能当空会话。
- install.sh 运行全套候选门禁后复制部署；禁止手工追加旧 Cordis mount 行或只复制 index.js。
- 修改后必须运行本仓库 scripts/*.test.mjs（如存在）及共享 check-candidate.py；Web 插件须通过真实浏览器检查。
- 更新 DSH 前用独立、已安装依赖的候选源码运行门禁；通过后再切换生产版本。原生 ctx/events 仍需候选版本验证。

# blank-session-gc

DSH host-only 守护插件：全局最多保留一条未使用空会话，其余从 workspace 账本和 JSONL 目录删除。

## Architecture

- 单半插件（仅 host，无浏览器半、无 `dsh.client`）：
  - `lib/logic.js` — 纯函数：`isOrdinarySession` / `isUnusedBlank` / `pickVictims`；
  - `lib/index.js` — 守护：启动扫一次；`session/created` 防抖 250ms 再扫。
- 删除顺序：`workspace.detachSession` → `rm` `<dshHomePath('sessions')>/<projectKey>/<encodedId>`。
- 本体没有 `session.delete`，Host 也丢掉了 `AgentHandle.dispose`。不要对活 agent 调 `scope.dispose`（会撕成半残且不一定卸注册表）。活着的牺牲者留在本进程，直到重启；账本和磁盘日志仍会清掉。

## Conventions

- 源码真身在本仓库；`install.sh` 复制部署到 `$DSH_HOME/profiles/node_modules/<包名>/`（绝不 symlink）。
- host 半改动必须重启 dsh web。
- 提交身份用命令级 env 覆盖，不写持久 git config。

## Gotchas & Decisions

- **对照 DSH 0.1.2-alpha.5 (`b4a2a68`)**：`list()` 返回 `{ header, revision, eventCount?, sizeBytes? }`，没有 `inspect()` / 公开 `locate()`。冷日志用 `open(id,'read')` + `read()` + `close()`；live 用 `session.snapshotEvents()`。磁盘擦除走 `dshHomePath('sessions')` 下按 encodeSegment(id) 找到的目录。SQLite 无对应文件夹时只摘账本。
- **不要用 symlink 部署**：Node ESM 会解析到仓库路径，然后找不到 `@deepseek-ai/schemastery`。
- **包名两处一致**：`package.json` `name` 与 `cordis.patch.yml` 挂载行 `name`。
- **Config 必须是 schemastery schema**，不能是普通函数。
- 只 GC 普通会话：`header.origin` 缺省。`subagent` 与 `automation`（以及之后任何 classified origin）永不删除。
- Host `sessionListMetadata.blank` 只被 `turn/start` 清掉；权限钉选、`/plan`、`/goal`、改标题都不算使用。
- 超过 64KiB 的冷日志视为已使用，不 `inspect`。
- Host `session-controller` 仍丢掉 `AgentHandle.dispose`（只留 `.agent`）。不要对活 agent 调 `scope.dispose`。

## Commands

- `./install.sh` — 部署（幂等）
- `node scripts/pick-victims.test.mjs` — 纯函数
- `node --check`：ESM 复制为 `.mjs` 再查
- 生效验证：`cd ~/.dsh/profiles/web && node -e "await import('dsh-plugin-blank-session-gc')"`
- 运行观察：`pm2 logs dsh-web --lines 80 --nostream | grep blank-session-gc`

## Module Map

单包。`lib/logic.js` + `lib/index.js`。参见 `README.md`。
