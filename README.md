# TampermonkeyScriptHub

一个基于 **Cloudflare Workers** + **R2 存储** 构建的轻量级油猴脚本（Tampermonkey）托管中心。支持脚本的上传、远程导入、版本解析及一键安装。

## 🚀 功能特性

- **完全无服务器化**：基于 Cloudflare Workers，无需购买传统服务器。
- **持久化存储**：利用 Cloudflare R2 存储脚本文件，稳定可靠。
- **脚本元数据解析**：自动解析脚本内的 `@name`、`@version`、`@author` 等信息并展示。
- **管理控制台**：
    - **本地上传**：支持 `.user.js` 文件直接上传。
    - **远程导入**：通过 URL 直接抓取远程脚本。
    - **管理列表**：支持查看、删除以及一键复制源码。
- **免密安装**：脚本分发地址（Raw 链接）无需密码，方便油猴插件自动更新。
- **安全验证**：管理后台采用密码访问机制，保障脚本库安全。

## 🛠️ 环境准备

1.  **Cloudflare 账号**。
2.  **R2 存储桶**：在 Cloudflare 控制台创建一个 R2 Bucket（例如命名为 `example-scripts-bucket`）。
3.  **Workers 权限**：确保已开启 Workers 服务。

## 📦 部署步骤

### 1. 后端部署 (Cloudflare Workers)
1.  创建一个新的 Worker。
2.  将提供的 `worker.js` 代码粘贴进编辑器。
3.  **绑定 R2 存储桶**：
    - 在 Worker 设置页面 -> **Settings** -> **Variables**。
    - 找到 **R2 Bucket Bindings**，添加绑定。
    - **Variable name** 必须填：`SCRIPTS_BUCKET`。
    - **R2 bucket** 选择您刚刚创建的存储桶。
4.  **设置管理密码**：
    - 在同一页面的 **Environment Variables** 中添加。
    - **Variable name**: `ADMIN_PASSWORD`。
    - **Value**: `example_password_123`（请修改为您自己的密码）。
5.  点击 **Save and Deploy**。

### 2. 前端配置 (index.html)
1.  打开 `index.html`。
2.  找到 `const WORKER_BASE_URL = '...'` 这一行（约在第 155 行）。
3.  将其修改为您 Worker 的实际访问域名：
    ```javascript
    const WORKER_BASE_URL = '[https://example-hub.your-subdomain.workers.dev](https://example-hub.your-subdomain.workers.dev)';
    ```
4.  您可以将此 HTML 文件部署在 GitHub Pages、Cloudflare Pages，或者直接本地浏览器打开使用。

## 🖥️ 使用说明

1.  访问前端页面，输入您设置的 `ADMIN_PASSWORD` 进入控制台。
2.  **上传脚本**：点击“本地上传”或“远程导入”来添加脚本。
3.  **安装脚本**：在脚本库列表中点击“安装脚本”，浏览器油猴插件会自动捕获并弹出安装界面。
4.  **Raw 链接格式**：脚本的直接访问地址为 `https://example-hub.your-subdomain.workers.dev/raw/example.user.js`。

## ⚠️ 安全建议

- **跨域配置 (CORS)**：代码中默认允许所有 Origin (`*`)，生产环境下建议在 `worker.js` 的 `handleCors` 函数中将 `Access-Control-Allow-Origin` 修改为您前端页面所在的具体域名。
- **敏感信息**：切勿将包含真实密码和域名信息的 `index.html` 或 `worker.js` 上传至公共代码库。

---
如果您觉得这个项目对您有帮助，欢迎给个好评！