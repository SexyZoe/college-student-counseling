# 当前开发交接：校园 Web 迁移

- 工作分支：`codex/campus-web-migration`。
- 微信完整源码快照：`wechat-final-2026-09-24`，对应 `fa2f90115ea2ba34de066095cda8a5453222f52d`，已推送并核实远端。
- 入口：`/web/`；学生、辅导员、管理员统一浏览器登录。
- 开发：`npm --prefix server ci`，`npm start`。
- 测试：`npm test`；`npm ci`、`npx playwright install chromium`、`npm run test:web`。
- 前端：`server/web/`；题库与FAQ：`shared/`；评分：`utils/scoring-engine.js`；后端：`server/src/`。
- 本次没有业务表结构迁移，沿用现有账号和数据；保持历史加密密钥不变。
- 文档：`docs/校园Web上线手册.md`、`docs/Web迁移与恢复.md`、`docs/Web迁移验收记录.md`。
- 当前校园服务器HTTP服务可达，发布需要运维SSH权限；不能仅凭本地测试声明已部署到学校。
- 正式运行仍需学校确认量表/内容、隐私与联系人、风险响应、HTTPS和网络边界，并完成校园真机验收。
