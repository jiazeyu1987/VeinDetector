# GET /detection-results/{task_id}

- 入口：backend/main.py `get_detection_results`
- 返回：原始 dict（未声明 `response_model`）

## 执行流程
1. 检查 `task_id` 是否存在于 `processing_tasks`，否则 404。
2. 遍历 `task.detection_results`（`VeinDetectionResult`），提取 `frame_number/vein_regions/confidence/processing_time` 形成列表。
3. 组装返回：`task_id/status/total_frames/processed_frames/detection_results`，并附带：
   - `roi_center`：若 `task.current_roi` 存在，返回中心坐标。
   - `statistics`：若存在 ROI，调用全局 `roi_handler.get_roi_statistics()`。

## 设计理由
- 提供详细检测输出供前端可视化或调试。
- 附带 ROI 位置和稳定性统计，解释跟踪行为。

## 优点
- 字段与内部模型一致，前端解析成本低。
- 即使任务未完成也能获取增量结果，支持实时查看。

## 问题与风险
- 无分页/截断，长视频会返回巨大 JSON，对内存与网络消耗高。
- `processing_time` 在后台逻辑中固定为 0.0，缺少性能基线。
- ROI 统计来自全局 `ROIHandler`，不同任务间会互相污染；删除任务也未重置。
- 返回未绑定 `response_model`，缺少自动校验与 OpenAPI 文档。
- 当任务 FAILED 时仍返回 success 结构，且不携带错误原因。
