# blank-session-gc

DSH host-only 守护插件：全局最多保留一条未使用空会话，其余从 workspace 账本和 JSONL 目录删除。

## Architecture

- 单半插件（仅 host，无浏览器半、无 `dsh.client`）：
  - `lib/logic.js` — 纯函数：`isUnusedBlank` / `pickVictims`；
  - `lib/index.js` — 守护：启动扫一次；`session/created` 防抖 250ms 再扫。
- 删除顺序：`workspace.detachSession` → `rm` `locate()` 指向的会话目录。
- 本体没有 `session.delete`，Host 也丢掉了 `AgentHandle.dispose`。不要对活 agent 调 `scope.dispose`（会撕成半残且不一定卸注册表）。活着的牺牲者留在本进程，直到重启；账本和磁盘日志仍会清掉。

## Conventions

- 源码真身在本仓库；`install.sh` 复制部署到 `$DSH_HOME/profiles/node_modules/<包名>/`（绝不 symlink）。
- host 半改动必须重启 dsh web。
- 提交身份用命令级 env 覆盖，不写持久 git config。

## Gotchas & Decisions

- **不要当正式 session.delete**：这是部署私有擦除，绑在 JSONL `locate().path` 的父目录上。SQLite 后端 `locate()` 为 undefined，插件会摘账本但删不掉库行。
- **不要用 symlink 部署**：Node ESM 会解析到仓库路径，然后找不到 `@deepseek-ai/schemastery`。
- **包名两处一致**：`package.json` `name` 与 `cordis.patch.yml` 挂载行 `name`。
- **Config 必须是 schemastery schema**，不能是普通函数。
- 子代理（`header.origin === 'subagent'`）永不删除。
- 超过 64KiB 的冷日志视为已使用，不 `inspect`。

## Commands

- `./install.sh` — 部署（幂等）
- `node scripts/pick-victims.test.mjs` — 纯函数
- `node --check`：ESM 复制为 `.mjs` 再查
- 生效验证：`cd ~/.dsh/profiles/web && node -e "await import('dsh-plugin-blank-session-gc')"`
- 运行观察：`pm2 logs dsh-web --lines 80 --nostream | grep blank-session-gc`

## Module Map

单包。`lib/logic.js` + `lib/index.js`。参见 `README.md`。
