# dsh-plugin-blank-session-gc

DSH host 守护插件：库里最多只留 **一条未使用的空对话**。

Web 点「新建对话」仍会立刻 `session.create`。这条空会话切走后从侧栏消失，但会留在 workspace 账本和 JSONL 会话库里。本插件不改本体创建路径：监听到新会话后扫描，删掉其余未使用空会话。

## 行为

- 触发：进程启动一次；之后每次普通会话 `session/created`（防抖 250ms）。
- **未使用**：日志里没有 `turn/start`。权限钉选、`/plan`、`/goal`、改标题都不算使用。
- **保留**：所有未使用空会话里 `createdAt` 最新的那一条（并列比 id）。
- **删除**：从每个 workspace 的 `sessionIds` 摘掉，并删掉 JSONL `locate().path`（日志文件）的父目录。
- 只处理普通会话（`header.origin` 缺省）。子代理（`origin: 'subagent'`）和 Automation 开火（`origin: 'automation'`）不碰。
- 仍挂在本进程里的空会话卸不掉（Host 丢掉 `AgentHandle.dispose`）。账本和磁盘会清；进程内那条等重启消失。

本体 `SessionPersistence` 没有公开 delete。JSONL `locate()` 返回日志文件路径，删其父目录是这条部署上唯一能真擦掉会话日志的办法；SQLite `locate()` 为 undefined，只能摘账本。

## 安装 / 更新

```sh
./install.sh
# ~/.dsh/profiles/web/cordis.patch.yml:
#   - insert:
#       - id: blank-session-gc
#         name: dsh-plugin-blank-session-gc
pm2 restart dsh-web
```

## 验证

- 部署后：`cd ~/.dsh/profiles/web && node -e "await import('dsh-plugin-blank-session-gc')"`
- 纯函数：`node scripts/pick-victims.test.mjs`
- 运行日志：`pm2 logs dsh-web --lines 80 --nostream | grep blank-session-gc`
