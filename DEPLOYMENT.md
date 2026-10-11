# 阿里云轻量应用服务器部署说明

## 推荐系统

建议选择：

```text
Ubuntu 22.04 LTS 64 位
```

如果购买页只有 Ubuntu 24.04 LTS，也可以选。不要选 Windows Server；2 核 2G 跑 Windows 会比较吃力，也不适合这个 Docker 部署方式。

如果阿里云镜像里有 Docker 应用镜像，也可以选 Docker 镜像；本质上仍然是 Linux + Docker。

## 服务器配置

个人使用建议：

```text
2 核 2G / 3M / 60GB
```

更稳一点：

```text
2 核 4G / 3M 或 5M / 60GB
```

2 核 2G 可以运行本应用。2 核 4G 的优势是构建 Docker 镜像、系统更新和以后扩展时更从容。

## 需要准备

- 一个阿里云轻量应用服务器
- 一个域名，解析到服务器公网 IP
- 服务器防火墙开放 `80`、`443`、`22`
- 一个足够长的访问密码
- 可选：OpenAI-compatible API Key

## 第一次部署流程

1. 登录服务器。
2. 上传项目到：

```text
/opt/mail-reply-studio
```

3. 在服务器上安装 Docker：

```text
cd /opt/mail-reply-studio
sudo bash scripts/server-setup.sh
```

4. 创建 `.env`：

```text
APP_DOMAIN=你的域名
APP_ACCESS_PASSWORD=换成一个足够长的访问密码
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

5. 启动：

```text
docker compose -f docker-compose.prod.yml up -d --build
```

6. 查看状态：

```text
docker compose -f docker-compose.prod.yml ps
```

7. 用浏览器打开：

```text
https://你的域名
```

首次访问会弹出密码框。

## 后续更新

把新代码上传到服务器同一个目录后运行：

```text
cd /opt/mail-reply-studio
bash scripts/update-server.sh
```

更新脚本会先备份 `.mail-reply-data`，再重新构建和启动容器。

## 备份

手动备份：

```text
cd /opt/mail-reply-studio
bash scripts/backup-data.sh
```

备份文件会放到：

```text
backups/
```

还建议在阿里云控制台定期创建服务器快照。

## 数据位置

应用数据在 Docker 卷里：

```text
mail_reply_data
```

不要删除这个卷，否则知识库、语气库、模型设置会丢失。

## 回滚

如果更新后有问题：

1. 保留当前备份文件。
2. 把旧版本代码重新上传。
3. 运行：

```text
docker compose -f docker-compose.prod.yml up -d --build
```

如果数据也需要恢复，再从 `backups/` 里的压缩包恢复。
