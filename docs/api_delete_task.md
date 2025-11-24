# DELETE /tasks/{task_id}

- 入口：backend/main.py `delete_task`
- 返回：`APIResponse(success=True)`

## 执行流程
1. 校验 `task_id` 是否存在于 `processing_tasks`，否则 404。
2. 预留的文件清理逻辑为空（`pass`），当前不会删除任何磁盘文件。
3. 从 `processing_tasks` 删除任务；若 `detection_settings` 有对应键也删除。
4. 返回成功消息和 task_id。

## 设计理由
- 为前端提供手动取消/清理任务的入口。

## 优点
- 实现简单，调用即可释放内存中的任务结构。

## 问题与风险
- 未停止后台 `process_video_background` 协程，删除中的任务仍会运行并写入已移除的状态，可能引发异常或脏数据。
- 未清理 `uploads/outputs` 文件，磁盘占用会持续增长。
- 缺乏状态校验和审计，COMPLETED/FAILED 也可删除且不可恢复。
- 若在后台协程启动前即删除，`process_video_background` 读取 `processing_tasks[task_id]` 时会抛 KeyError。
