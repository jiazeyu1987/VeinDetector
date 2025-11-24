# GET /

- 路径/方法：GET /
- 返回模型：backend/models.py 中的 `APIResponse`
- 作用：提供版本和可用接口列表，作为前端探活与入口。

## 执行流程
1. 构造 `APIResponse(success=True, message="...", data={version, endpoints})`。
2. 无状态读取，无磁盘或模型依赖，直接返回。

## 设计理由
- 作为轻量级健康检查和接口自描述，避免前端硬编码路径。
- 使用 Pydantic `response_model`，便于 Swagger 校验返回结构。

## 优点
- 响应快且无副作用，可用于负载均衡/存活探测。
- 返回的 endpoints 提供人工文档指针（如 `/docs`）。

## 问题与风险
- 未检查视频处理/模型实际可用性，内部异常时仍报告 success。
- endpoints 列表为硬编码，易与代码漂移。
- 未暴露构建信息（git hash/启动时间），排障价值有限。
