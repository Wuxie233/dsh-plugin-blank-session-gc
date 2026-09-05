## 当前接入方式：dsh-std adapter

本插件通过 dsh-plugin.json 声明标准 host facet；lib/index.js 发布
plugins.starpivot.dev/v1 HostPlugin，lib/host.js 保留业务策略并接收 adapter API。
有浏览器界面的插件另声明 LocalModule，使用私有 WebPlugin surface。

执行 ./install.sh 会先验证全部九个自制插件的组合、Web 界面与 CodeCarry
原生 Remote，再备份并复制部署；失败不替换生产插件。需先安装同级 dsh-std
维护仓库及其依赖。部署后在没有活跃任务时重启 dsh，并刷新 Web。

不要把 lib/index.js 直接作为 Cordis 插件挂载；原插件的 cordis insert 行由
共享部署器移除，配置迁入 adapter.componentConfigs。不要链接运行时插件目录。
标准协议不承诺未来版本永久兼容；native ctx/hooks 的变化由候选门禁和集中
adapter 维护控制。Web 界面不会自动出现在原生 Android 中。

下方保留业务说明和历史修复记录；涉及旧式直接挂载、导入和安装步骤的内容，
以本节为准。

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
