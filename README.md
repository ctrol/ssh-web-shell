# SSH Web Shell

一个基于网页版 SSH 终端工具，通过浏览器登录到远程服务器进行简单操作。

## 功能特点

- 网页版终端界面（基于 xterm.js）
- 支持密码和 SSH 登录
- 支持私钥（PEM 格式）登录
- 支持私钥密码保护的私钥
- 实时终端输出，支持 ANSI 颜色
- 自动窗口大小自适应
- 连接状态可视化
- 简单的操作（ls / 断开

## 技术栈

- **后端**: Node.js + Express + WebSocket + ssh2
- **前端**: xterm.js + 原生 JavaScript

## 安装与运行

### 前置条件

```bash
# 进入项目目录
cd ssh-web-shell

# 安装依赖
npm install

# 启动服务
npm start
```

服务将在 http://localhost:3000 启动。

打开浏览器访问 http://localhost:3000

### 自定义端口

```bash
PORT=8080 npm start
```

## 使用方法

1. 在左侧输入框中输入：
   - **主机地址**: 目标 SSH 服务器的 IP 或域名
   - **端口**: SSH 端口（默认 22）
   - **用户名**: SSH 用户名
   - **认证方式**:
     - **密码**: 输入 SSH 登录密码
     - **私钥**: 粘贴 PEM 格式的私钥内容，如有密码（可选）

2. 点击 **连接** 按钮

3. 在右侧终端中进行操作

4. 完成后点击 **断开** 按钮或输入 `exit` 退出

## 项目结构

```
ssh-web-shell/
├── server.js          # 后端服务，SSH 连接代理
├── package.json
├── public/
│   ├── index.html  # 页面
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js   # 前端逻辑
└── README.md
```

## 安全提示

- 本工具通过 Node.js 服务器运行在您本地，所有 SSH 连接由服务端发起
- 不要将本服务暴露在公网时应启用 HTTPS 和认证
- 连接信息仅在内存中处理，不会记录到任何第三方
- 私钥内容在建立连接时加密密码在后端处理，不会在前端存储
- 所有凭据仅在建立连接时在内存中处理

## 常见问题

**Q: 连接失败？
- 确保目标服务器的 SSH 端口是否开放
- 检查网络连接信息是否正确
- 如使用密码认证，确保服务器支持密码登录（PasswordAuthentication yes

**Q: 使用私钥登录？
- 确保私钥格式为 PEM（OpenSSH 或 RSA 格式）
- 将 `-----BEGIN ... PRIVATE KEY-----` 开头
- 如私钥被加密，需填写私钥密码

**Q: 终端显示乱码？
- 目标服务器的 locale 设置可能影响

## 许可证

MIT
