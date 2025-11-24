# GET /processing-status/{task_id}

- 入口：backend/main.py `get_processing_status`
- 返回：`ProcessingProgressResponse`

## 执行流程
1. 校验 `task_id` 是否存在于 `processing_tasks`，否则 404。
2. 读取 `processed_frames` 与 `total_frames` 计算进度（缺失总帧时进度为 0）。
3. 若已处理帧数 > 0，按 `elapsed = now - created_at` 推算剩余时间 `estimated_time`。
4. 如已有 `detection_results`，汇总 `total_detected_veins`、平均置信度、已处理帧数生成 `detection_summary`。
5. 返回进度、状态、当前帧索引、总帧数、估计剩余时间及摘要。

## 设计理由
- 支持前端轮询查看进度与粗略 ETA，减少频繁拉取完整结果。
- 提供检测概览，便于列表或概览页展示。

## 优点
- 计算简单，无额外 IO。
- `response_model` 保证字段范围（progress 0-100）与类型。

## 问题与风险
- 进度依赖 `task.total_frames`，若 `get_video_info` 失败或为 0，进度将一直为 0。
- ETA 基于平均速率，启动抖动或动态负载会导致估计失真。
- `detection_summary` 对全量结果求均值，长视频会带来大的序列化开销，且没有滑动窗口。
- 全局 `processing_tasks` 缺乏并发保护，读写竞态可能读到旧值。
- 当任务 FAILED 时未返回 `error_message`，前端无法展示失败原因。
