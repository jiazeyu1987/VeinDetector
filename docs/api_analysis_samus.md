# POST /analysis/samus

- 入口：backend/main.py `analyze_frame_with_samus`
- 请求体：`SamusAnalysisRequest`（`image_data_url`, `roi`, `model_name`, `parameters`）
- 响应：`APIResponse.data` 为 `SamusMaskResponse`（mask/采样点/连通域信息等）

## 执行流程
1. 记录日志（模型名、ROI、参数 keys）。调用 `decode_image_from_data_url` 将 data URL 解码为 RGB numpy，失败返回 400/500。
2. 若 `model_name` 属于传统 CV 列表（cv/cv-vein/opencv/cv_enhanced/cv-advanced/cv-frangi/cv_simple_center）：
   - 选择 `CVVeinSegmentor` / `EnhancedCVVeinSegmentor` / `SimpleCenterCVVeinSegmentor` 执行 `segment(image, roi, parameters)`。
   - mask 维度检查失败则 500，否则封装 `SamusMaskResponse(width,height,mask.tolist())` 直接返回。
3. 其他模型：
   - {"samus", "samus-ultrasound", "unet", "unet++"} 使用 `SamusVeinSegmentor.segment`（依赖 `segmentation_models_pytorch`，无权重时返回全零）。
   - {"cv_enhanced", "cv-frangi"} 仍调用增强 CV；"elliptical_morph" 系列调用 `EllipticalMorphSegmentor`；未知模型回退到 Samus。
   - mask 非二维时报 500。
4. 若 parameters 中启用 `max_connected_component_enabled` / `roi_center_connected_component_enabled` / `selected_point_connected_component_enabled`：
   - 读取 ROI 坐标、打印大量日志。
   - 对 mask 执行 `connectedComponentsWithStats`，选最大连通域，随机采样最多 10 个点，计算中心并构造 `ConnectedComponentCenter`。
5. 构造 5 个固定采样点（25%/50%/75% 位置）并标记是否落在 mask 内。
6. 计算标志位与 `processing_info`（算法名、mask 尺寸、像素计数、开关），组装 `SamusMaskResponse` 并返回。

## 设计理由
- 为前端提供单帧实时分割与调参能力。
- 支持深度模型与多种传统 CV/形态学算法，降低依赖和部署成本。
- 连通域分析帮助选择最稳定的穿刺点或中心线。

## 优点
- 模型路由集中，前端通过 `model_name` 即可切换算法。
- ROI 裁剪后再回填到原尺寸，便于在前端叠加显示。
- 参数透传允许快速实验阈值、结构元素等超参。

## 问题与风险
- 所有计算在事件循环内同步执行（torch/CV），高分辨率帧或首次加载模型会长时间阻塞其他请求。
- `segmentation_models_pytorch` 未必安装且未加载自定义权重，SamusVeinSegmentor 可能一直输出全零 mask 但仍返回 success。
- `mask.astype(int).tolist()` 会生成巨大 JSON，可能耗尽内存或带宽。
- 连通域坐标使用整图坐标但注释称 ROI 相对坐标，且 ROI 越界只记录日志不裁剪，前端易被误导。
- `processing_info['roi_size']` 实为整图尺寸；`roi_center_connected` 等标志未用于连通域决策。
- 连通域随机抽样使用 `np.random.choice`，不可复现且未设随机种子。
- `parameters` 缺乏边界校验，非法值可能导致 OpenCV 异常。
- 日志包含乱码且量大（逐点打印），在生产环境会淹没有效日志。
