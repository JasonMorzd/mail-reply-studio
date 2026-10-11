# Mac mini 部署说明

## 现在不在 Mac mini 身边怎么办

如果 Mac mini 之前没有开启远程控制，就不能直接隔空部署。你需要满足下面任意一种条件：

- Mac mini 已经安装并登录 Tailscale、向日葵、TeamViewer 等远程工具。
- Mac mini 已开启“远程登录”或“屏幕共享”，并且你能通过内网、Tailscale 或其他安全网络连上它。
- 有人在 Mac mini 旁边，可以帮你完成第一次设置。

如果以上都没有，只能等你接触到 Mac mini，或让家里人/同事帮你做一次初始化。

## 第一次初始化，给帮忙的人照着做

1. 打开 Mac mini，进入桌面。
2. 安装 Tailscale，并登录你的账号：

```text
https://tailscale.com/download/mac
```

3. 打开系统设置：

```text
系统设置 → 通用 → 共享
```

开启：

- 远程登录
- 屏幕共享，或远程管理

4. 把这个项目文件夹放到 Mac mini，例如：

```text
~/mail-reply-studio
```

5. 打开终端，运行：

```text
cd ~/mail-reply-studio
bash scripts/macos-setup.sh
```

脚本会安装依赖、生成生产构建，并注册开机自启服务。

## 手机不连本地 Wi-Fi 也能访问

推荐两种方式。

### 方式一：Tailscale

手机和 Mac mini 都登录同一个 Tailscale 账号后，手机可以通过 Mac mini 的 Tailscale 地址访问：

```text
http://Mac-mini-Tailscale-IP:3000
```

这个方式比较私密，不公开到互联网。

### 方式二：Cloudflare Tunnel

适合临时给任何网络下的手机访问。先安装 cloudflared：

```text
brew install cloudflared
```

然后运行：

```text
cd ~/mail-reply-studio
bash scripts/macos-remote.sh
```

终端会显示一个 `https://*.trycloudflare.com` 地址。手机打开这个地址即可访问。临时地址重启后可能变化。

## 日常维护

查看应用日志：

```text
cd ~/mail-reply-studio
bash scripts/macos-logs.sh
```

停止开机自启服务：

```text
cd ~/mail-reply-studio
bash scripts/macos-stop.sh
```

更新应用：

```text
cd ~/mail-reply-studio
pnpm install
pnpm build
launchctl stop com.mail-reply-studio.app
launchctl start com.mail-reply-studio.app
```

## 关于 OpenClaw 和内存

这套部署默认不使用 Docker，比较省内存。应用本身只负责网页、SQLite 和调用 DeepSeek 等云端 API，不在 Mac mini 上跑本地大模型。

16GB 内存通常够用。若 OpenClaw 之前出现过闪退，建议：

- 不要同时跑本地大模型。
- 关闭不用的浏览器标签和后台应用。
- 先用 Tailscale 访问，避免额外隧道工具长期运行。
- 定期查看“活动监视器”的内存压力。

应用数据保存在项目目录的 `.mail-reply-data`，建议定期备份这个文件夹。

## 更新和同步

推荐把代码放到一个私有 GitHub 仓库，Mac mini 只保存一份运行代码和一份数据。首次配置完成后，更新分为两部分：

- 代码更新：从当前电脑推送到私有仓库，Mac 拉取新代码并重新构建。
- 数据同步：不需要手动复制。手机、平板和其他电脑都访问 Mac mini 上的同一个应用，因此使用的是同一份 `.mail-reply-data`。

在 Mac mini 上更新：

```text
cd ~/mail-reply-studio
pnpm mac:update
```

如果当前电脑已经能通过 Tailscale SSH 连接 Mac mini，可以从 Windows 电脑远程触发更新：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-mac.ps1 -MacHost 100.x.x.x -MacUser 你的Mac用户名
```

这个命令会让 Mac 自动备份数据库、拉取代码、安装依赖、重新构建并重启应用。访问密码和 `.mail-reply-data` 不会从代码仓库同步，也不会被更新覆盖。

## 推荐的长期工作方式

1. 在当前电脑修改和测试代码。
2. 推送到私有 GitHub 仓库。
3. 远程执行 `scripts/update-mac.ps1`，或让 Mac 运行 `pnpm mac:update`。
4. 手机继续打开同一个 Tailscale 地址或固定 HTTPS 地址。

这样不需要把代码压缩包反复复制到 Mac，也不需要在手机上做任何更新。
