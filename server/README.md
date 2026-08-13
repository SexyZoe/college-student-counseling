# 数智心港湾后端

本目录提供测评数据闭环的第一阶段后端：登录鉴权、固定版本任务、测评结果持久化、服务器复算、风险事件、辅导员授权班级查询、学期切换和审计记录。

## 本地启动

本地开发需要 Node.js 22.13 或更高版本，生产容器固定使用 Node.js 24 LTS。当前使用 Node 内置 SQLite，启动时出现 SQLite experimental warning 不影响本地原型运行。

```bash
AUTH_SECRET="请替换为随机长字符串" npm run server
```

默认地址为 `http://127.0.0.1:8787`，数据库文件位于 `server/data/app.db`。健康检查：

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/ready
```

运行全部测试：

```bash
npm test
```

`/health`只表示HTTP进程存活；`/ready`还会访问数据库，用于判断实例能否接收业务流量。

## Docker开发环境

在仓库根目录执行：

```bash
cp .env.compose.example .env
```

编辑`.env`并设置至少32个字符的本地`AUTH_SECRET`，然后运行：

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

执行不输出令牌的核心冒烟测试：

```bash
docker compose exec backend node scripts/smoke-test.js
```

需要人工演练容器重建时，可先写入持久化探针，执行`docker compose down`并重新启动，再读取探针：

```bash
docker compose exec -e PROBE_MODE=write -e PROBE_ID=local-rebuild-test backend node scripts/persistence-probe.js
docker compose down
docker compose up -d
docker compose exec -e PROBE_MODE=read -e PROBE_ID=local-rebuild-test backend node scripts/persistence-probe.js
```

停止容器但保留测试数据：

```bash
docker compose down
```

当前Compose安全基线包括非root用户、只读根文件系统、移除Linux capabilities、禁止权限提升、健康检查、优雅停止和独立数据卷。生产镜像采用多阶段构建，运行阶段不包含npm、npx和Corepack。SQLite容器只用于开发测试，正式环境仍需迁移到学校MySQL或华为云RDS。

本地复查生产镜像高危漏洞：

```bash
docker scout cves --only-severity critical,high --format packages local://shuzhi-backend:sqlite
```

## 生产配置要求

- `NODE_ENV=production`时必须提供至少32个字符的`AUTH_SECRET`；
- 生产环境默认不创建演示账号；只有使用虚构数据的开发/CI环境才能设置`SEED_DEMO_DATA=true`；
- `CORS_ALLOWED_ORIGINS`使用英文逗号分隔允许的Web后台域名，生产环境默认不放行跨域来源；
- `DATABASE_PATH`必须指向持久化卷；
- 请求体、请求超时、请求头超时和优雅关闭时限均可通过`.env.example`中的变量配置；
- 密钥不得写入镜像、Compose文件、Git仓库或日志；
- 对外流量应由学校网关、WAF或反向代理提供HTTPS，应用容器无需直接保存证书。

## 让微信开发者工具连接后端

先启动服务，然后在开发者工具调试控制台执行：

```javascript
wx.setStorageSync("backendApiBaseUrl", "http://127.0.0.1:8787")
wx.setStorageSync("backendSyncEnabled", true)
```

重新登录小程序后会获得后端令牌，之前离线提交的结果会自动重试。关闭后端同步：

```javascript
wx.setStorageSync("backendSyncEnabled", false)
```

本地开发时还需在微信开发者工具中启用“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。真机不能使用手机自身的 `127.0.0.1` 访问电脑，请改用电脑局域网地址；正式环境必须使用已配置为小程序合法域名的 HTTPS 地址。

## 主要接口

| 方法 | 地址 | 角色 | 用途 |
|---|---|---|---|
| POST | `/api/v1/auth/login` | 全部 | 登录并获取限时令牌 |
| GET | `/api/v1/assessment-tasks` | 学生 | 获取当前学期、当前班级任务 |
| POST | `/api/v1/assessment-results` | 学生 | 幂等提交结果，由服务器重新评分 |
| GET | `/api/v1/assessment-results/me` | 学生 | 查询自己的结果摘要 |
| GET | `/api/v1/counselor/classes` | 辅导员 | 查询授权班级统计 |
| GET | `/api/v1/counselor/classes/:id/summary` | 辅导员 | 查询授权班级学生摘要 |
| GET | `/api/v1/counselor/risk-events` | 辅导员 | 查询授权范围内风险事件 |
| PATCH | `/api/v1/counselor/risk-events/:id` | 辅导员 | 更新跟进状态与记录 |
| GET | `/api/v1/counselor/students/:id/summary` | 辅导员 | 查询授权学生必要摘要，不返回原始答案 |
| GET/POST | `/api/v1/admin/semesters` | 管理员 | 查询、创建学期 |
| PATCH | `/api/v1/admin/semesters/:id/current` | 管理员 | 切换当前学期 |
| POST | `/api/v1/admin/counselor-assignments` | 管理员 | 按学期分配辅导员班级权限 |
| GET | `/api/v1/admin/students` | 管理员 | 查询学生和班级基础信息 |
| GET | `/api/v1/admin/counselor-assignments` | 管理员 | 查询辅导员分配关系 |
| GET | `/api/v1/admin/import-batches` | 管理员 | 查询最近导入批次 |
| POST | `/api/v1/admin/import-batches/preview` | 管理员 | 解析 CSV 并生成差异预览，不写正式数据 |
| POST | `/api/v1/admin/import-batches/:id/confirm` | 管理员 | 单事务确认导入 |
| POST | `/api/v1/admin/import-batches/:id/rollback` | 管理员 | 根据变更快照整批回滚 |

## 人员 CSV 导入

管理员页面支持班级、学生、辅导员和分配关系的 CSV 预检、确认与整批回滚。当前稳定格式为 CSV，Excel 文件请先另存为 UTF-8 CSV；详细字段、模板和安全边界参见 [人员数据导入与回滚说明](../docs/人员数据导入与回滚说明.md)。

预检计划只保存密码摘要，不保存或返回明文初始密码。确认前若正式数据发生变化会拒绝写入；导入后数据再次变化时也会拒绝自动覆盖回滚。

## 安全边界

- 学生身份和班级以令牌对应的服务器账号为准，不接受客户端伪造的 `studentId`。
- 服务器根据固定评分规则和答案索引重新计算结果，客户端分数不一致时拒绝提交。
- `submissionId` 唯一，网络重试不会产生重复结果或重复风险事件。
- 辅导员查询必须同时匹配辅导员、班级和学期分配关系。
- 辅导员接口只返回必要结果摘要，不返回 `answer_snapshot_json`。
- 管理员切换学期不会修改历史任务、结果或风险事件的学期归属。
- 人员导入采用预检、单事务确认和变更快照回滚；新增实体回滚时停用而非物理删除。

## 上线前仍需完成

当前实现用于本地原型和接口联调。生产环境应迁移到 PostgreSQL 等托管数据库，使用学校统一认证或可靠身份源，将令牌密钥放入密钥管理系统，对答案快照进行字段级加密，限制 CORS 和请求来源，配置 HTTPS、备份、监控、告警、数据库迁移工具及多实例限流。评分规则和关键题必须由心理专业人员审核。
