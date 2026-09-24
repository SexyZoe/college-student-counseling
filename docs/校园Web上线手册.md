# 校园 Web 上线手册

## 入口与环境

师生打开同一网址 `/web/`，按身份登录。二维码编码该网址；手机需先连接能到达服务器的校园 Wi-Fi。微信扫码可能在微信内置浏览器打开，同样访问网页；不需要发布微信小程序。

现有实例的试运行入口是 `http://172.18.132.12/web/`。HTTP 仅用于虚构数据联调；生产 Cookie 使用 Secure，因此正式部署须使用学校提供的 HTTPS 入口。

## 发布前

1. 检查 Git 提交、工作区状态，记录原提交和镜像ID。
2. 确认已有环境变量及密钥，不重新生成历史数据加密密钥。
3. 执行 `bash deploy/mysql-backup.sh`，保存数据库与媒体备份；密钥分开保管。
4. 本地/CI 通过 `npm test`、`npm run test:web`、容器构建、MySQL业务契约。
5. 学校确认域名、证书、实际内网访问边界、隐私资料、量表与内容专业审核、危机跟进安排。

## 校内虚构数据试运行

```bash
cd /home/rgzntest1/shuzhi-heart-harbor
git status --short
git fetch origin
# 仅在核实工作区干净后切换已验收的 Web 提交/分支。
git switch codex/campus-web-migration
bash deploy/deploy.sh
curl --fail http://127.0.0.1/ready
curl --fail http://127.0.0.1/web/ >/dev/null
```

若本地尚无迁移分支，使用 `git switch --track origin/codex/campus-web-migration`。部署脚本在已有 MySQL 运行时先备份，再构建和替换后端。此为单机部署，有短暂中断。不要清空卷，不覆盖 `.env` 或已有 `compose.override.yaml`。

## 正式环境配置

使用独立正式数据库/卷，避免把演示账号及内容混入真实业务。必需配置：

- `NODE_ENV=production`、`SEED_DEMO_DATA=false`。
- 高强度 `AUTH_SECRET`、`DATA_ENCRYPTION_KEY`、`METRICS_TOKEN`，按现有配置检查要求提供。
- `SCHOOL_NAME`、`SUPPORT_PHONE`、`SUPPORT_LOCATION`、`SUPPORT_HOURS`、`PRIVACY_CONTACT`、`RETENTION_NOTICE`。
- `CAMPUS_SITE_URL=https://学校分配的域名`，仅校园网可达。
- `CAMPUS_CERT_DIRECTORY`：服务器目录，含 `fullchain.pem` 和 `privkey.pem`；证书需被使用的手机信任，不能要求用户忽略证书错误。
- `MYSQL_CA_FILE`：用于校验 MySQL 服务器证书的 CA 文件；MySQL 服务器需配置有效证书且主机名匹配。
- `SCHOOL_RELEASE_RECORD`：学校上线确认记录的本地文件路径。预检只检查文件存在，不判断内容是否已获批准。

将上述变量安全地加载进 shell 环境后执行 `npm run check:release`。不要把密钥写入 Git 或聊天记录。

正式 Compose 在原校园覆盖文件基础上增加 TLS 配置：

```bash
docker compose -f compose.yaml -f compose.override.yaml -f deploy/compose.production.yaml --profile mysql-runtime config -q
docker compose -f compose.yaml -f compose.override.yaml -f deploy/compose.production.yaml --profile mysql-runtime build backend-mysql mysql-migrate
docker compose -f compose.yaml -f compose.override.yaml -f deploy/compose.production.yaml --profile mysql-runtime up -d --wait backend-mysql gateway
```

正式后端仅发布到宿主机环回地址，MySQL不发布宿主机端口。服务器防火墙/校园路由仍需限制HTTPS入口仅对学校批准网段开放（包括IPv6）；`GATEWAY_BIND` 默认绑定所有接口，本身不构成校内访问控制。

## 初始化正式管理员

空业务数据库无需导入演示数据。使用后端容器内的一次性初始化脚本，从环境变量读取临时密码；示例在 Bash 中运行，输入内容不回显：

```bash
read -r -s -p '管理员临时密码（12至64位）: ' BOOTSTRAP_ADMIN_PASSWORD
export BOOTSTRAP_ADMIN_PASSWORD
docker compose -f compose.yaml -f compose.override.yaml -f deploy/compose.production.yaml exec -e BOOTSTRAP_ADMIN_PASSWORD backend-mysql node scripts/bootstrap-admin.js
unset BOOTSTRAP_ADMIN_PASSWORD
```

脚本仅在不存在管理员时创建账号，拒绝覆盖现有账号。首次登录必须改密。随后管理员创建学期并设为当前，导入学生名单，创建辅导员并分配班级，创建并发布测评任务。

## 验收与性能

必须在学校真实网络上分别验证：手机默认浏览器、微信内置浏览器、电脑浏览器；校园Wi-Fi可达、移动数据与外网不可达；首次登录、完整测评、刷新恢复、断网重试、教师摘要和跟进、名单导入、内容审核/下架。

HTTP层测试和本机浏览器测试不能证明校园Wi-Fi覆盖、真机兼容或全校并发容量。根据计划同时测评人数在独立数据环境压测，避免在正式环境批量创建测试结果。查看 `server/scripts/load-test.js` 支持的配置。

后台不承诺24小时监控，也未自动配置短信/邮件通知。学校需要安排人员定期查看风险页面，确认响应时限和紧急升级渠道。

## 回退

详见 `docs/Web迁移与恢复.md`。回退代码不自动回退数据，优先保留现有业务数据；需要恢复备份时必须停写、确认备份和目标实例后由运维执行，不能直接覆盖正在接收学生提交的数据库。

## 生成入口二维码

开发机安装根目录依赖后运行：

```bash
node scripts/create-entry-qr.js 'https://学校分配的域名/web/' artifacts/campus-entry.png
```

二维码只编码网址，不含身份和密码。打印前用真实手机扫码核对访问地址、HTTPS证书和网页版本。不要将试运行HTTP二维码作为正式入口长期张贴。
