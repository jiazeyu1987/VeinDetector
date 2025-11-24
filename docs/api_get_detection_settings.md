# GET /detection-settings

- 入口：backend/main.py `get_detection_settings`
- Query：可选 `task_id`
- 返回：`DetectionSettings`

## 执行流程
1. 若提供 `task_id` 且存在于 `detection_settings` 字典，则返回对应对象。
2. 否则直接返回新的默认 `DetectionSettings()` 实例（使用硬编码默认值）。

## 设计理由
- 允许按任务覆盖检测阈值，同时提供默认配置以便前端初始化表单。

## 优点
- Pydantic 限制各参数范围，减少无效输入。
- 不会抛 404，调用简单。

## 问题与风险
- 忽略了 `detection_settings['default']`，全局默认更新不会在 GET 中体现。
- 后台检测并未读取该字典，实际生效的参数取决于全局 `VeinDetector`，与返回值可能不一致。
- 数据不持久化，重启后历史配置丢失。
- 未提供更新时间/来源，难以审计或对比当前生效配置。
