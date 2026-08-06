# 数智心港湾后端

本目录提供测评数据闭环的第一阶段后端：登录鉴权、固定版本任务、测评结果持久化、服务器复算、风险事件、辅导员授权班级查询、学期切换和审计记录。

## 本地启动

需要 Node.js 22.13 或更高版本。当前使用 Node 内置 SQLite，启动时出现 SQLite experimental warning 不影响本地原型运行。

```bash
AUTH_SECRET="请替换为随机长字符串" npm run server
```

默认地址为 `http://127.0.0.1:8787`，数据库文件位于 `server/data/app.db`。健康检查：

```bash
curl http://127.0.0.1:8787/health
```

运行全部测试：

```bash
npm test
```

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

## 安全边界

- 学生身份和班级以令牌对应的服务器账号为准，不接受客户端伪造的 `studentId`。
- 服务器根据固定评分规则和答案索引重新计算结果，客户端分数不一致时拒绝提交。
- `submissionId` 唯一，网络重试不会产生重复结果或重复风险事件。
- 辅导员查询必须同时匹配辅导员、班级和学期分配关系。
- 辅导员接口只返回必要结果摘要，不返回 `answer_snapshot_json`。
- 管理员切换学期不会修改历史任务、结果或风险事件的学期归属。

## 上线前仍需完成

当前实现用于本地原型和接口联调。生产环境应迁移到 PostgreSQL 等托管数据库，使用学校统一认证或可靠身份源，将令牌密钥放入密钥管理系统，对答案快照进行字段级加密，限制 CORS 和请求来源，配置 HTTPS、备份、监控、告警、数据库迁移工具及多实例限流。评分规则和关键题必须由心理专业人员审核。
