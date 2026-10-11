# 个人邮件回复助手

## 在手机和其他设备访问

应用默认监听 `0.0.0.0:3000`，因此电脑和手机连接同一个 Wi-Fi 后，可以通过电脑的局域网地址访问。

当前这台电脑的局域网地址是：

```text
http://192.168.31.47:3000
```

如果路由器重新分配了地址，请在电脑上运行 `ipconfig`，找到当前 Wi-Fi 网卡的 IPv4 地址，再把它替换到上面的地址中。

首次从手机访问时，如果 Windows 防火墙弹出提示，请允许 Node.js 在“专用网络”通信。应用数据仍保存在运行服务的电脑上，所以手机和电脑看到的是同一份语气库、知识库和设置。

可以在手机浏览器中选择“添加到主屏幕”，以后会像普通应用一样打开。

## 从外网访问

局域网地址只能在同一个网络内使用。若需要在外出时访问，建议使用 Tailscale 等带身份验证的私有网络，或者部署到带持久化磁盘和 HTTPS 的云服务器。

当前应用没有登录系统，不建议直接把 `3000` 端口暴露到公网。部署到公网前应先增加访问认证，并把 `.mail-reply-data` 放在持久化磁盘中。

如果只是需要一个简单的个人访问保护，可以在启动前设置：

```text
APP_ACCESS_PASSWORD=设置一个足够长的密码
```

设置后，浏览器会弹出访问密码框。公网使用时仍应配合 HTTPS；这个密码保护是应用层的基础保护，不代替云服务器、防火墙和 HTTPS 配置。

### 临时远程访问

项目已经提供 Cloudflare HTTPS 临时隧道。它不需要手机连接本地 Wi-Fi，也不需要在路由器上配置端口转发，但运行服务的电脑必须保持开机并联网。

1. 安装 [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)。
2. 在项目目录运行：

```text
pnpm remote
```

3. 设置一个远程访问密码。
4. 等待终端显示 `https://*.trycloudflare.com` 地址，用手机或其他设备打开这个地址。

远程脚本会在 `3001` 端口启动一个单独的、带密码保护的应用实例，不会直接暴露已有的本地开发服务。

临时地址在停止并重新启动隧道后可能变化。需要固定域名时，应在 Cloudflare 账户中创建正式 Tunnel，或使用下面的 Docker 方式部署到云服务器。

### 部署到云服务器

项目包含 `Dockerfile`、`docker-compose.prod.yml` 和 `Caddyfile`，适合部署到支持 Docker 和持久化磁盘的云服务器。完整步骤见 `DEPLOYMENT.md`。

服务器上创建 `.env`：

```text
APP_DOMAIN=你的域名
APP_ACCESS_PASSWORD=换成一个足够长的密码
```

然后运行：

```text
docker compose -f docker-compose.prod.yml up -d --build
```

Caddy 会自动申请 HTTPS 证书。`mail_reply_data` 卷用于保存本地 SQLite 数据，不能删除，否则知识库和语气库会丢失。

无论使用临时隧道还是云服务器，应用的 API 密钥和邮件知识库都应只放在受信任的环境中。当前应用是单用户工具，公网部署时不要关闭访问密码。

## 启动

开发模式：

```text
pnpm dev
```

生产模式：

```text
pnpm build
pnpm start
```

## Mac mini 部署

Mac mini 推荐使用非 Docker 部署，节省内存，并通过 macOS 开机服务保持运行。

完整步骤见：

```text
MAC_MINI_DEPLOYMENT.md
```

Mac mini 作为唯一主机时，手机和其他设备只访问 Mac 上的同一个网址，知识库和历史数据会自动保持一致。后续代码更新可以通过私有 Git 仓库和 `scripts/update-mac.ps1` 远程触发，不需要每次手动复制整个项目。
