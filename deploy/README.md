# 校园云部署与日常操作

## 已部署环境

实例：Ubuntu 24.04，`172.18.132.12`；账号：`rgzntest1`；项目目录：`/home/rgzntest1/shuzhi-heart-harbor`。

请求路径：小程序 → 校园网 → Nginx `80` → Node.js `8787` → MySQL `3306`。

| 组件 | 部署方式 | 可访问范围 |
|---|---|---|
| Nginx | `gateway` 容器 | 实例 80 端口，是否可达由校园网络决定 |
| Node.js | `backend-mysql` 容器 | 容器网络和宿主机 `127.0.0.1:8787` |
| MySQL 8.4 | `mysql` 容器 + `mysql-data` 卷 | 仅容器网络，没有发布宿主机数据库端口 |
| 数据库迁移 | `mysql-migrate` 一次性容器 | 启动后端前执行 |

`deploy/compose.cloud.yaml` 在实例安装为根目录 `compose.override.yaml`，由 Docker Compose 自动合并。它将 SQLite 服务改为手动选择的 profile，并为校园环境指定 `192.168.240.0/24` 容器网段。换一个网络环境部署前，仍应确认此网段不与实际路由冲突。

这是一台云实例上的单机容器部署，不是 Kubernetes 集群、托管数据库或高可用架构。发布可能有短暂中断。

## 小程序连接

1. 在微信开发者工具中打开本项目；电脑必须能访问学校内网实例。
2. 内网 HTTP 调试需在开发者工具本地设置启用“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。这仅用于开发调试，不是正式发布方案。
3. 若曾配置本机后端，在开发者工具调试控制台执行以下两行，再重新编译、重新登录：

```javascript
wx.setStorageSync("backendApiBaseUrl", "http://172.18.132.12")
wx.setStorageSync("backendSyncEnabled", true)
```

学生 `2024001`、辅导员 `T001`、管理员 `admin`；演示密码均为 `123456`。这里使用虚构演示数据。

默认地址定义在 `utils/deployment-config.js`；本地存储配置优先级更高。云端模式下失败不会自动退回本地演示登录。纯离线演示可显式设置 `backendSyncEnabled` 为 `false`。

手机真机是否能访问取决于所在校园网段；关闭域名校验不能解决路由不通。公网/微信正式发布仍需可达的 HTTPS 域名、证书及微信侧配置。

## Mac 连通性检查

以下命令在 Mac 终端执行，不是在实例中执行：

```bash
route -n get 172.18.132.12
curl --noproxy '*' --interface en0 --max-time 10 http://172.18.132.12/ready
ssh -o 'ProxyCommand=nc -b en0 -G 8 %h %p' -o ConnectTimeout=12 rgzntest1@172.18.132.12
```

`en0` 是本次实际 Wi-Fi 接口；换电脑/网卡需调整。SSH 按提示输入服务器账号密码。这里按接口发出连接，在本次 Mac + VPN 配置下已经验证可用，但并不是对所有 VPN 都适用的设置，也不会自动改变微信开发者工具的路由。

看到 `rgzntest1@rgzntest1` 提示符后才是在 Ubuntu 实例。`systemctl`、`ip route` 等 Linux 命令应在那里执行，不能放在 Mac 的 `sexyzoe@...` 提示符下执行。

## 实例日常操作

以下命令均在 SSH 登录实例后执行：

```bash
cd /home/rgzntest1/shuzhi-heart-harbor
docker compose --profile mysql-runtime ps
curl --fail http://127.0.0.1/ready
docker compose logs --tail 100 backend-mysql gateway
```

更新源代码后发布：

```bash
bash deploy/deploy.sh
```

脚本校验 Compose、为运行中的 MySQL 备份、构建后端与迁移镜像、等待服务健康，然后检查网关就绪。不会删除数据卷。普通发布不会覆盖已有 `compose.override.yaml`；修改网关配置后应校验 Nginx 配置并重启网关，修改网络则需单独安排网络重建，不应当作普通应用发布处理。

冒烟验证（使用演示账号，不输出令牌）：

```bash
docker compose exec -T backend-mysql node scripts/smoke-test.js
docker compose --profile mysql-runtime run --rm --no-deps mysql-migrate node scripts/mysql-schema-smoke.js
```

结构检查使用事务回滚，可对已存在当前学期的数据运行。`runtime-contract-test.js` 会创建任务、切换学期并产生业务数据，只应在专用测试数据环境运行，不要当作只读健康检查。

## 备份和恢复演练

```bash
bash deploy/mysql-backup.sh
bash deploy/verify-restore.sh backups/上一步输出的文件名.sql.gz.enc
```

备份流程：MySQL 一致性逻辑导出 → gzip → AES-256-CBC/PBKDF2 加密 → SHA-256 文件校验。校验和用于检测损坏，不等同于带认证加密。密钥在 `backups/.encryption-key`；数据和密钥都不进入 Git/小程序包。

恢复脚本在临时、无网络、内存数据盘的 MySQL 容器里验证导入，随后只删除该临时容器及其临时卷，不覆盖在线数据库。它验证可解密、可导入及表/迁移数据存在，不等同于所有业务语义均已验证。

已启用 systemd 定时器：每日北京时间 03:15 后随机延迟最多 5 分钟备份；每分钟做一次就绪与带令牌指标检查。未配置外部通知，失败记录在 journal。

```bash
systemctl list-timers shuzhi-backup.timer shuzhi-health.timer
systemctl show shuzhi-backup.service shuzhi-health.service -p Id -p Result
journalctl -u shuzhi-backup.service -u shuzhi-health.service --since today --no-pager
```

重装实例时安装定时器（单元文件中的账号/目录已针对当前实例设置）：

```bash
sudo install -m 644 deploy/shuzhi-backup.service deploy/shuzhi-backup.timer deploy/shuzhi-health.service deploy/shuzhi-health.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now shuzhi-backup.timer shuzhi-health.timer
```

目前备份和密钥仍在同一实例，不具备整机丢失后的灾备能力，也未配置自动保留期清理。下一阶段应将备份和密钥分开保管、异地保存，并配置空间告警和通知渠道。

## 当前边界

已完成校园内网部署、接口验证以及微信开发者工具编译/预览包生成；尚未完成真机完整点击验收、公网 HTTPS、学校统一身份认证、业务/专业审核及真实人员导入。不能把当前状态描述为已获准服务真实学生的生产系统。
