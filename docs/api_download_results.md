# GET /download-results/{task_id}

- 入口：backend/main.py `download_results`
- Query：`format`（默认 "json"，也是唯一支持值）
- 返回：`FileResponse` 指向 `outputs/<task_id>_results.json`

## 执行流程
1. 校验 `task_id` 是否存在于 `processing_tasks`，否则 404。
2. 当 `format == "json"`：
   - 构造 `results_data`：任务元数据 + `detection_results` 的 `result.dict()` + （可选）`roi_handler.get_roi_statistics()`。
   - 写入 `OUTPUT_DIR/<task_id>_results.json`（`ensure_ascii=False, indent=2`）。
   - 返回 `FileResponse`，下载名为 `<原始文件名>_results.json`。
3. 其他 `format` 返回 400。

## 设计理由
- 提供离线下载能力，便于将检测结果导入其他工具。
- 仅支持 JSON 降低实现复杂度。

## 优点
- 使用 Pydantic `dict()` 保持字段一致性。
- 文件落盘后可复用，不依赖任务仍存于内存。

## 问题与风险
- 写文件在请求线程内，长视频的大 JSON 会阻塞事件循环。
- 未检查任务状态，未完成或 FAILED 也会导出空/部分结果，且不提示。
- ROI 统计来自全局 `ROIHandler`，可能与该任务不一致。
- 输出文件缺乏清理策略，重复调用会覆盖，旧文件会堆积。
- 无鉴权/路径隔离，知晓 task_id 即可下载数据。
