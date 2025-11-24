# GET /health

- 入口：backend/main.py `health_check`
- 返回：静态 dict `{status: "healthy", timestamp, components: {...}}`

## 执行流程
1. 直接构造包含 `status`、当前 `timestamp`、组件列表（video_processor/vein_detector/roi_handler 均标记 "ok"）的字典。
2. 返回 JSON，不依赖外部资源。

## 设计理由
- 提供最小化健康探针，便于部署或监控。

## 优点
- 无依赖、响应快，适合作为负载均衡存活检测。
- 返回组件键为未来扩展留口。

## 问题与风险
- 未实际检测模型、GPU、磁盘读写或后台任务队列，内部故障时仍报告健康。
- 未区分 liveness/readiness，模型未加载完成时也会返回 healthy。
- 时间戳无时区信息，跨时区日志对齐困难。
