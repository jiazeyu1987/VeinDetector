# POST /upload-video

- 入口：backend/main.py `upload_video`
- 请求：`multipart/form-data`，字段 `file` 为视频文件。
- 响应：`VideoUploadResponse`（task_id/status/message/video_url）。

## 执行流程
1. `VideoProcessor.is_supported_format` 仅按扩展名检查（.mp4/.mov/.avi/.mkv），未校验真实编码。
2. `content = await file.read()` 将完整文件读入内存；随后检查空文件与 500MB 上限。
3. `save_uploaded_video` 生成 UUID 文件名并写入 `uploads/`，再次做扩展名校验。
4. `get_video_info` 使用 OpenCV 读取 fps、frame_count、分辨率，为进度与 ROI 初始化提供数据。
5. 创建 `VideoProcessingTask`（total_frames=frame_count），写入全局 `processing_tasks`，并设置 `detection_settings[task_id] = DetectionSettings()`。
6. 通过 `asyncio.create_task(process_video_background(...))` 启动后台处理，后台协程将状态切换为 PROCESSING。
7. 记录日志并返回 `VideoUploadResponse`（status=PENDING，video_url=/uploads/<uuid>.<ext>）。

## 设计理由
- 通过异步后台任务避免上传请求阻塞。
- UUID 命名降低文件名冲突风险，便于直接暴露静态资源。
- 内存字典替代数据库，降低原型阶段的复杂度。

## 优点
- 流程直观，上传后立即拿到 task_id 供轮询。
- 复用 `VideoProcessor` 统一预处理与信息提取。
- 尺寸保护（500MB）可以避免极端大文件。

## 问题与风险
- 全量 `await file.read()` 会对大文件造成内存暴涨，上限检查发生在读完之后。
- 仅看扩展名，无法阻止恶意/损坏文件导致 OpenCV 打不开或崩溃。
- 异常路径无清理：已写入的文件、`processing_tasks` 条目、`detection_settings` 条目及后台任务句柄都未释放。
- 后台处理共享全局 `ROIHandler`/`VeinDetector`，多任务会互相污染 ROI 位置和检测参数。
- 任务与文件仅存在于内存/磁盘，进程重启后任务丢失且文件残留。
- 后台处理在事件循环中执行 CPU 密集的 OpenCV/NumPy，可能阻塞其他请求。
- 返回状态为 PENDING，但若后台立即失败（如 KeyError 或视频打开失败），前端无处获知原因。
