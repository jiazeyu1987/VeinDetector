# PUT /detection-settings

- 入口：backend/main.py `update_detection_settings`
- Query：可选 `task_id`
- Body：`DetectionSettings`

## 执行流程
1. 若提供 `task_id`：不存在则 404；存在则写入 `detection_settings[task_id] = settings`，若任务状态为 PROCESSING 则调用全局 `vein_detector.update_settings(settings.dict())` 试图即时生效。
2. 未提供 `task_id`：写入 `detection_settings['default'] = settings`，并直接调用 `vein_detector.update_settings` 更新全局检测器。
3. 返回 `APIResponse(success=True, data=settings.dict())`。

## 设计理由
- 允许运行时调整 Canny/Hough/面积等阈值，以改善检测效果。
- 复用 GET/PUT 同一路径，简化前端交互。

## 优点
- Pydantic 校验保证参数范围合理，降低崩溃概率。
- 理论上支持对运行中的任务做动态调参，减少重新上传的成本。

## 问题与风险
- 全局 `vein_detector` 被所有任务共享，多任务同时存在时调参会互相污染。
- `process_video_background` 并未读取 `detection_settings` 字典，新启动的任务不会应用 task_id 级配置。
- 更新发生在无锁环境，可能与后台检测线程竞态。
- 配置无持久化/版本记录，重启即丢失；无法追踪是谁何时改动。
- 允许对 FAILED/COMPLETED 任务写入配置，但这些值不会生效，易产生误解。
