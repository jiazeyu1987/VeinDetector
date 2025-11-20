# VeinDetector 交付拆解（基于现有栈：FastAPI + OpenCV/PyTorch + React/TS + Vite）

## 阶段 1：补齐后端基础与接口对齐（优先级高，~2.5 天）
- **核心目标**：让前后端接口一致，视频上传/状态/结果流闭环可用。  
- **验收标准**：
  - 完成 5 个核心接口（上传、状态、结果、ROI CRUD、单帧分割代理），Postman/pytest 覆盖 100% 通过。
  - 本地跑 `python main.py` 后，前端可成功上传视频并看到处理进度/结果。
- **任务（按优先级排序）**  
  1. 统一后端路由到前端期望的 `/videos/*`、`/analysis/*` 路径，保留兼容老接口（4h）  
  2. 上传接口增加表单流式保存、类型/大小校验、异常返回一致化（2h）  
  3. 状态与结果接口返回字段对齐前端 `types.ts`（frameIndex/veins 结构），新增 ROI GET/POST/DELETE 内存实现（6h）  
  4. 单帧分割 `/analysis/samus` 增加模型名校验 & 参数约束，错误码标准化（3h）  
  5. 补充接口级 pytest（使用 httpx.AsyncClient）覆盖上传->状态->结果 happy path 和 3 个失败用例（5h）  

## 阶段 2：持久化与任务生命周期（优先级高，~3 天）
- **核心目标**：摆脱内存状态，任务/视频/ROI/结果可落地，可重启恢复。
- **验收标准**：
  - SQLite/PostgreSQL 任一完成最小表：videos、detection_tasks、detection_results、roi_annotations。
  - 重启后能继续查询历史任务（至少 3 条），状态持久化准确。
  - 任务删除会清理上传文件与结果文件。
- **任务**  
  1. 引入轻量 ORM（SQLAlchemy 已在栈内）建表 + 简单迁移脚本（4h）  
  2. 上传/处理流程写库：task 创建、进度更新、结果落地 JSON/表（6h）  
  3. 任务查询/删除接口改为查库并清理文件（3h）  
  4. ROI CRUD 持久化到 roi_annotations，附 task_id 关联（3h）  
  5. 启动时恢复未完成任务为 `failed` 并可查询（2h）  

## 阶段 3：前端真实对接与交互完善（优先级中高，~2.5 天）
- **核心目标**：前端从 mock 切换到真实 API，完成上传-预览-单帧分割-结果展示闭环。
- **验收标准**：
  - 关闭 mock 后，上传/进度/结果/ROI 在 UI 可视化正常。
  - 单帧分割参数面板可驱动 `/analysis/samus`，mask 叠加显示正常。
  - 手动/自动 ROI 编辑与保存可回显。
- **任务**  
  1. `apiClient` 切换真实 BASE_URL，补齐错误提示与 loading 态（3h）  
  2. MainLayout 结果面板消费真实 `VeinDetectionResult`（含置信度过滤、帧跳转）（5h）  
  3. 上传/进度轮询 UI（播放控制、暂停/恢复展示）对接 `/videos/...`、`/processing-status`（3h）  
  4. ROIEditor 保存/读取对接 ROI 接口，增加失败回退（2h）  
  5. 基于 Playwright/React Testing Library 加 2-3 个关键交互用例（上传流、分割触发、ROI 保存）（5h）  

## 阶段 4：检测管线与多模型策略优化（优先级中，~3 天）
- **核心目标**：处理管线更稳，可配置多分割策略，增加性能/稳定性保障。
- **验收标准**：
  - 支持选择 CV/SMP/椭圆形态学三类分割，参数校验与日志齐全。
  - 添加超时/异常保护，长视频不会卡死；处理速度基线：720p 30s 视频 < 60s 完成（本地）。
  - 输出结果包含处理耗时、置信度统计，供前端显示。
- **任务**  
  1. 在后台处理协程中加入超时/速率控制与异常降级（2h）  
  2. 分割器参数 schema 校验 + 默认值集中管理（3h）  
  3. 处理统计：每帧耗时、平均置信度、总帧率，写入结果（3h）  
  4. 基准脚本：固定视频跑三种模型，输出耗时和帧率对比（4h）  
  5. 结果文件增加简易可视化（保存叠加框/中心点的 PNG 序列或 GIF 可选）（4h）  

## 阶段 5：安全、鉴权与配置（优先级中，~2 天）
- **核心目标**：最小可用安全层与配置化。
- **验收标准**：
  - JWT 鉴权护住写操作（上传、ROI、删除），读接口允许匿名或受限。
  - 基础速率限制（如 60 rpm/IP）生效。
  - `.env` 统一配置，禁用默认密钥检查通过。
- **任务**  
  1. 接入 FastAPI JWT 依赖（fastapi-users or 自行实现），写接口加 `Depends`（5h）  
  2. 简易用户存储（内存或表 users）+ 租户配置（可选）（3h）  
  3. 速率限制中间件（slowapi/starlette-limiter）配置与验证（2h）  
  4. 配置加载：`.env` + Pydantic Settings，启动时校验必填项（2h）  

## 阶段 6：部署与质量基线（优先级中，~2 天）
- **核心目标**：形成可复用的本地/云部署与质量检查流程。
- **验收标准**：
  - `docker-compose` 一键启动（API+前端+DB+Redis 可选）成功；自检脚本通过。
  - CI 任务跑 lint + 关键测试，全绿。
- **任务**  
  1. 更新 docker-compose.dev.yml：挂载代码、暴露 8000/3000，添加可选 PG/Redis 服务（4h）  
  2. 增加 `make check` 或 `scripts/check.sh` 跑 black/flake8/pytest、前端 `pnpm lint test --filter critical`（3h）  
  3. GitHub Actions 简版 CI（后端 lint+pytest，前端 lint）（4h）  
  4. 自检脚本扩展（基于 `backend/test_system.py` 增加上传/状态/结果验证）（2h）  

> 时间为开发净时估算，不含评审/等待；可并行的子任务请视人力拆分。优先执行阶段 1-3 以打通产品体验，再推进持久化与安全。***
