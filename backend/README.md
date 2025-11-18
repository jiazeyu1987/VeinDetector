# 超声静脉检测系统 Python后端

基于FastAPI + OpenCV开发的超声静脉检测和跟踪系统，支持视频上传、静脉检测、ROI自动跟踪等功能。

## 功能特性

### 核心功能
- ✅ **视频上传与解码** - 支持MP4/MOV/AVI/MKV格式
- ✅ **视频抽帧** - 每秒8帧抽帧处理
- ✅ **静脉检测算法** - Canny边缘检测 + 霍夫圆变换 + 椭圆拟合
- ✅ **ROI自动跟踪** - 智能区域跟踪和平移
- ✅ **连通域分析** - 筛选有效静脉区域
- ✅ **RESTful API** - 完整的REST接口

### 检测算法
- **Canny边缘检测**: 高精度边缘提取
- **霍夫圆变换**: 圆形静脉检测
- **椭圆拟合**: 椭圆静脉拟合优化
- **连通域分析**: 基于形态学的区域分析
- **智能过滤**: 多重条件筛选有效静脉

### ROI跟踪功能
- **自动平移**: 保持ROI大小，智能移动中心点
- **平滑移动**: 历史数据驱动的平滑移动算法
- **移动预测**: 基于历史趋势的位置预测
- **边界检测**: 自动边界限制和调整

## 项目结构

```
backend/
├── main.py              # FastAPI主应用
├── models.py            # 数据模型定义
├── video_processor.py   # 视频处理模块
├── vein_detector.py     # 静脉检测核心算法
├── roi_handler.py       # ROI处理和跟踪
├── requirements.txt     # 依赖包列表
├── start.sh            # 启动脚本
├── README.md           # 项目说明
├── uploads/            # 上传文件目录
└── outputs/            # 输出文件目录
```

## 快速开始

### 1. 环境准备

```bash
# 进入项目目录
cd backend

# 运行启动脚本（自动安装依赖和启动服务）
chmod +x start.sh
./start.sh
```

### 2. 手动安装

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
# 或使用uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问服务

- **API文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/health
- **根路径**: http://localhost:8000/

## API接口文档

### 1. 视频上传

```http
POST /upload-video
Content-Type: multipart/form-data

Body: video_file (file)
```

**响应示例:**
```json
{
  "task_id": "uuid-string",
  "filename": "video.mp4",
  "status": "pending",
  "message": "视频上传成功，开始处理..."
}
```

### 2. 处理进度查询

```http
GET /processing-status/{task_id}
```

**响应示例:**
```json
{
  "task_id": "uuid-string",
  "status": "processing",
  "progress": 45.5,
  "current_frame": 91,
  "total_frames": 200,
  "estimated_time": 12.3,
  "detection_summary": {
    "total_detected_veins": 156,
    "average_confidence": 0.78,
    "processed_frames": 91
  }
}
```

### 3. 获取检测结果

```http
GET /detection-results/{task_id}
```

**响应示例:**
```json
{
  "task_id": "uuid-string",
  "status": "completed",
  "total_frames": 200,
  "processed_frames": 200,
  "detection_results": [
    {
      "frame_number": 0,
      "vein_regions": [
        {
          "center": [150, 200],
          "radius": 15.5,
          "area": 756.2,
          "perimeter": 97.3,
          "ellipticity": 0.85,
          "confidence": 0.82,
          "bbox": [135, 185, 30, 30]
        }
      ],
      "confidence": 0.82,
      "processing_time": 0.156
    }
  ],
  "roi_center": {"x": 150, "y": 200},
  "statistics": {
    "total_movements": 156,
    "stability_rate": 0.85,
    "drift_rate": 0.12
  }
}
```

### 4. 检测设置

```http
GET /detection-settings?task_id={task_id}
PUT /detection-settings?task_id={task_id}
```

**检测参数说明:**
- `canny_threshold_low`: Canny边缘检测低阈值 (0-255)
- `canny_threshold_high`: Canny边缘检测高阈值 (0-255)
- `hough_dp`: 霍夫圆变换累加器分辨率倒数
- `hough_min_dist`: 霍夫圆变换最小圆心距离
- `hough_param1`: 霍夫圆变换Canny边缘检测高阈值
- `hough_param2`: 霍夫圆变换圆心检测阈值
- `min_vein_area`: 最小静脉区域面积
- `max_vein_area`: 最大静脉区域面积
- `elliptical_tolerance`: 椭圆度容差

### 5. 下载结果

```http
GET /download-results/{task_id}?format=json
```

### 6. 任务管理

```http
DELETE /tasks/{task_id}
```

## 使用示例

### Python客户端示例

```python
import httpx
import asyncio

async def upload_and_process_video():
    # 上传视频
    with open("video.mp4", "rb") as f:
        files = {"file": ("video.mp4", f, "video/mp4")}
        async with httpx.AsyncClient() as client:
            response = await client.post("http://localhost:8000/upload-video", files=files)
            result = response.json()
            task_id = result["task_id"]
    
    # 监控处理进度
    while True:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"http://localhost:8000/processing-status/{task_id}")
            status = response.json()
            
            if status["status"] == "completed":
                print("处理完成！")
                break
            elif status["status"] == "failed":
                print("处理失败！")
                break
            
            print(f"进度: {status['progress']:.1f}%")
            await asyncio.sleep(2)
    
    # 获取结果
    async with httpx.AsyncClient() as client:
        response = await client.get(f"http://localhost:8000/detection-results/{task_id}")
        results = response.json()
        print(f"检测到 {sum(len(r['vein_regions']) for r in results['detection_results'])} 个静脉区域")

# 运行
asyncio.run(upload_and_process_video())
```

### curl示例

```bash
# 上传视频
curl -X POST "http://localhost:8000/upload-video" \
     -H "accept: application/json" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@video.mp4"

# 查询进度
curl -X GET "http://localhost:8000/processing-status/{task_id}"

# 获取结果
curl -X GET "http://localhost:8000/detection-results/{task_id}"
```

## 配置说明

### 检测参数调优

根据不同的超声图像特点，可以调整以下参数：

1. **Canny边缘检测参数**:
   - `canny_threshold_low`: 50-100 (图像噪声较多时增大)
   - `canny_threshold_high`: 100-200 (与low参数成2-3倍关系)

2. **霍夫圆变换参数**:
   - `hough_min_dist`: 30-100 (静脉间距较大时增大)
   - `hough_param2`: 20-40 (检测敏感度，越小越敏感)

3. **面积过滤参数**:
   - `min_vein_area`: 50-200 (过滤小噪声)
   - `max_vein_area`: 1000-5000 (过滤大噪点)

## 性能优化

### 处理速度
- 视频抽帧: 8 FPS目标帧率
- 单帧处理: 平均0.1-0.3秒
- ROI跟踪: 实时处理，支持30FPS视频流

### 内存管理
- 自动清理临时文件
- 流式处理避免内存溢出
- 智能缓存机制

### 并发支持
- 异步处理框架
- 多任务并发执行
- 请求限流保护

## 故障排除

### 常见问题

1. **上传失败**: 检查文件格式和大小限制
2. **处理缓慢**: 调整检测参数，降低复杂度
3. **内存不足**: 处理大视频时启用分块处理
4. **检测效果差**: 调优Canny边缘检测参数

### 日志查看

```bash
# 查看实时日志
tail -f logs/app.log

# 查看错误日志
grep "ERROR" logs/app.log
```

## 开发指南

### 添加新的检测算法

在 `vein_detector.py` 中添加新的检测方法：

```python
def your_new_detection_method(self, frame: np.ndarray) -> List[Dict]:
    """自定义检测算法"""
    # 实现检测逻辑
    return detection_results
```

### 扩展API接口

在 `main.py` 中添加新的端点：

```python
@app.get("/your-endpoint")
async def your_function():
    # 实现功能
    return response
```

## 许可证

MIT License

## 支持

如有问题或建议，请通过以下方式联系：
- 提交GitHub Issue
- 发送邮件至开发团队

---

**版本**: v1.0.0  
**更新日期**: 2025-11-18