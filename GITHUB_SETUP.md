# GitHub 同步说明

这个项目是带后端 API、SQLite 和模型密钥的全栈应用，不适合直接部署到 GitHub Pages。推荐做法是：

1. GitHub 私有仓库保存代码。
2. Mac mini 或云服务器从 GitHub 拉取代码。
3. 数据库、API Key 和访问密码只保存在运行机器上，不上传到 GitHub。

## 第一次上传到 GitHub

在 GitHub 创建一个私有仓库，例如：

```text
mail-reply-studio
```

不要勾选自动生成 README、`.gitignore` 或 License。创建后，GitHub 会显示一个仓库地址，格式类似：

```text
https://github.com/你的用户名/mail-reply-studio.git
```

然后在本项目目录运行：

```text
git remote add origin https://github.com/你的用户名/mail-reply-studio.git
git push -u origin main
```

## 后续更新

本地修改并测试后运行：

```text
git add .
git commit -m "Update app"
git push
```

Mac mini 上更新：

```text
cd ~/mail-reply-studio
pnpm mac:update
```

云服务器上更新：

```text
cd /opt/mail-reply-studio
bash scripts/update-server.sh
```

## 不会上传的内容

下面这些内容已经被 `.gitignore` 排除：

- `.env`、`.env.local` 和其他本地密钥文件
- `.mail-reply-data` 本地数据库
- `.next` 构建缓存
- `node_modules`
- `logs`
- `backups`
- `work`
- `outputs`
- `tools`

`.env.example` 会上传，用作部署时填写配置的模板。
