# 静脉检测API接口文档

## 概述

静脉检测系统提供完整的RESTful API接口，用于视频上传、帧提取、静脉检测和ROI管理。

## 基础信息

- **Base URL**: `http://localhost:8000`
- **API版本**: v1
- **内容类型**: `application/json`
- **字符编码**: UTF-8

## 认证

当前版本无需认证，后续版本将添加JWT token认证。

## API接口列表

### 1. 视频上传

**接口**: `POST /api/upload-video`

**描述**: 上传视频文件到系统，支持多种视频格式。

**请求参数**:
- `Content-Type`: `multipart/form-data`
- `file`: 视频文件（必填，支持格式：mp4, avi, mov, mkv）
- `patient_id`: 患者ID（可选字符串）
- `description`: 视频描述（可选字符串）

**请求示例**:
```bash
curl -X POST http://localhost:8000/api/upload-video \
  -F "file=@/path/to/video.mp4" \
  -F "patient_id=P001" \
  -F "description=左手静脉检测视频"
```

**响应数据**:
```json
{
  "success": true,
  "message": "视频上传成功",
  "data": {
    "video_id": "video_20231118_001",
    "filename": "video.mp4",
    "file_size": 52428800,
    "duration": 120.5,
    "fps": 30,
    "resolution": "1920x1080",
    "upload_time": "2025-11-18T08:32:40Z",
    "patient_id": "P001",
    "description": "左手静脉检测视频",
    "status": "uploaded"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_FILE_FORMAT",
    "message": "不支持的文件格式",
    "details": "支持的格式：mp4, avi, mov, mkv"
  }
}
```

### 2. 获取帧列表

**接口**: `GET /api/frames/{video_id}`

**描述**: 获取指定视频的所有帧信息。

**路径参数**:
- `video_id`: 视频ID（必填）

**查询参数**:
- `start_frame`: 起始帧号（可选，默认0）
- `end_frame`: 结束帧号（可选，默认视频总帧数）
- `interval`: 帧间隔（可选，默认1，即每帧都获取）

**请求示例**:
```bash
curl -X GET "http://localhost:8000/api/frames/video_20231118_001?start_frame=0&interval=30"
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "video_id": "video_20231118_001",
    "total_frames": 3615,
    "frames": [
      {
        "frame_number": 0,
        "timestamp": 0.0,
        "image_url": "/api/frames/video_20231118_001/frame_0000.jpg",
        "width": 1920,
        "height": 1080
      },
      {
        "frame_number": 30,
        "timestamp": 1.0,
        "image_url": "/api/frames/video_20231118_001/frame_0030.jpg",
        "width": 1920,
        "height": 1080
      }
    ]
  }
}
```

### 3. 静脉检测

**接口**: `POST /api/detect-vein`

**描述**: 对指定帧进行静脉检测分析。

**请求参数**:
```json
{
  "video_id": "video_20231118_001",
  "frame_numbers": [0, 30, 60, 90],
  "algorithm": "advanced",
  "parameters": {
    "sensitivity": 0.8,
    "contrast_enhancement": true,
    "noise_reduction": true
  }
}
```

**参数说明**:
- `video_id`: 视频ID（必填）
- `frame_numbers`: 要检测的帧号数组（必填）
- `algorithm`: 检测算法（可选，值：basic/advanced，默认advanced）
- `parameters`: 算法参数（可选）
  - `sensitivity`: 敏感度（0.0-1.0，默认0.8）
  - `contrast_enhancement`: 对比度增强（布尔值，默认true）
  - `noise_reduction`: 降噪处理（布尔值，默认true）

**请求示例**:
```bash
curl -X POST http://localhost:8000/api/detect-vein \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "video_20231118_001",
    "frame_numbers": [0, 30, 60],
    "algorithm": "advanced"
  }'
```

**响应数据**:
```json
{
  "success": true,
  "message": "静脉检测完成",
  "data": {
    "task_id": "detection_20231118_001",
    "video_id": "video_20231118_001",
    "total_frames": 3,
    "processing_status": "completed",
    "results": [
      {
        "frame_number": 0,
        "detection_result": {
          "vein_points": [
            {"x": 120, "y": 150, "confidence": 0.95},
            {"x": 135, "y": 165, "confidence": 0.92}
          ],
          "vein_paths": [
            [
              {"x": 100, "y": 120},
              {"x": 120, "y": 150},
              {"x": 135, "y": 165}
            ]
          ],
          "analysis_metrics": {
            "vein_clarity": 0.87,
            "contrast_ratio": 0.42,
            "signal_noise_ratio": 15.2
          }
        },
        "annotated_image_url": "/api/detection/video_20231118_001/frame_0000_annotated.jpg",
        "processing_time": 2.34
      }
    ]
  }
}
```

### 4. 更新ROI

**接口**: `PUT /api/update-roi`

**描述**: 更新或创建感兴趣区域（ROI）标记。

**请求参数**:
```json
{
  "video_id": "video_20231118_001",
  "frame_number": 0,
  "roi_data": {
    "rois": [
      {
        "id": "roi_001",
        "type": "vein_region",
        "coordinates": {
          "x": 100,
          "y": 120,
          "width": 200,
          "height": 150
        },
        "label": "主要静脉区域",
        "priority": 1,
        "properties": {
          "vein_type": "radial_vein",
          "expected_clarity": "high"
        }
      }
    ]
  }
}
```

**参数说明**:
- `video_id`: 视频ID（必填）
- `frame_number`: 帧号（必填）
- `roi_data`: ROI数据（必填）
  - `rois`: ROI列表
    - `id`: ROI唯一标识（必填）
    - `type`: ROI类型（必填，值：vein_region/reference_point/exclusion_area）
    - `coordinates`: 坐标信息（必填）
    - `label`: ROI标签（必填）
    - `priority`: 优先级（必填，1-10，10为最高）
    - `properties`: 扩展属性（可选）

**请求示例**:
```bash
curl -X PUT http://localhost:8000/api/update-roi \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "video_20231118_001",
    "frame_number": 0,
    "roi_data": {
      "rois": [
        {
          "id": "roi_001",
          "type": "vein_region",
          "coordinates": {"x": 100, "y": 120, "width": 200, "height": 150},
          "label": "主要静脉区域",
          "priority": 1
        }
      ]
    }
  }'
```

**响应数据**:
```json
{
  "success": true,
  "message": "ROI更新成功",
  "data": {
    "video_id": "video_20231118_001",
    "frame_number": 0,
    "roi_count": 1,
    "rois": [
      {
        "id": "roi_001",
        "type": "vein_region",
        "coordinates": {"x": 100, "y": 120, "width": 200, "height": 150},
        "label": "主要静脉区域",
        "priority": 1,
        "created_time": "2025-11-18T08:32:40Z",
        "updated_time": "2025-11-18T08:32:40Z"
      }
    ]
  }
}
```

### 5. 获取检测结果

**接口**: `GET /api/detection-results`

**描述**: 获取指定视频的检测结果和ROI历史。

**查询参数**:
- `video_id`: 视频ID（必填）
- `frame_number`: 特定帧号（可选）
- `include_rois`: 是否包含ROI信息（可选，默认true）
- `include_metrics`: 是否包含分析指标（可选，默认true）

**请求示例**:
```bash
curl -X GET "http://localhost:8000/api/detection-results?video_id=video_20231118_001&include_rois=true"
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "video_info": {
      "video_id": "video_20231118_001",
      "filename": "video.mp4",
      "duration": 120.5,
      "total_frames": 3615,
      "upload_time": "2025-11-18T08:32:40Z"
    },
    "detection_summary": {
      "total_detections": 120,
      "avg_confidence": 0.87,
      "processing_time": 45.6,
      "algorithm_used": "advanced",
      "last_updated": "2025-11-18T08:35:20Z"
    },
    "frame_results": [
      {
        "frame_number": 0,
        "detection_status": "completed",
        "vein_detection": {
          "vein_points": 15,
          "avg_confidence": 0.92,
          "clarity_score": 0.89
        },
        "roi_data": {
          "active_rois": 3,
          "total_rois": 5,
          "last_update": "2025-11-18T08:32:40Z"
        },
        "annotated_image_url": "/api/detection/video_20231118_001/frame_0000_annotated.jpg"
      }
    ],
    "roi_history": [
      {
        "roi_id": "roi_001",
        "type": "vein_region",
        "created_time": "2025-11-18T08:32:40Z",
        "last_modified": "2025-11-18T08:34:15Z",
        "modifications": 2,
        "coordinates_history": [
          {"x": 100, "y": 120, "timestamp": "2025-11-18T08:32:40Z"},
          {"x": 95, "y": 115, "timestamp": "2025-11-18T08:34:15Z"}
        ]
      }
    ]
  }
}
```

## 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| `INVALID_FILE_FORMAT` | 400 | 不支持的文件格式 |
| `FILE_TOO_LARGE` | 413 | 文件大小超出限制 |
| `VIDEO_NOT_FOUND` | 404 | 视频不存在 |
| `FRAME_NOT_FOUND` | 404 | 帧不存在 |
| `DETECTION_FAILED` | 500 | 检测处理失败 |
| `ROI_UPDATE_FAILED` | 500 | ROI更新失败 |
| `INVALID_PARAMETERS` | 400 | 参数无效 |
| `INSUFFICIENT_STORAGE` | 507 | 存储空间不足 |

## 限制说明

- **文件大小限制**: 单个视频文件最大500MB
- **帧数限制**: 单次检测最多处理1000帧
- **并发限制**: 同时最多处理10个检测任务
- **存储限制**: 总存储空间最大10GB

## SDK示例

### Python SDK

```python
import requests

class VeinDetectionAPI:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
    
    def upload_video(self, video_path, patient_id=None, description=None):
        with open(video_path, 'rb') as f:
            files = {'file': f}
            data = {}
            if patient_id:
                data['patient_id'] = patient_id
            if description:
                data['description'] = description
            
            response = requests.post(
                f"{self.base_url}/api/upload-video",
                files=files,
                data=data
            )
            return response.json()
    
    def get_frames(self, video_id, start_frame=0, interval=1):
        params = {
            'start_frame': start_frame,
            'interval': interval
        }
        response = requests.get(
            f"{self.base_url}/api/frames/{video_id}",
            params=params
        )
        return response.json()
    
    def detect_vein(self, video_id, frame_numbers, algorithm="advanced"):
        data = {
            'video_id': video_id,
            'frame_numbers': frame_numbers,
            'algorithm': algorithm
        }
        response = requests.post(
            f"{self.base_url}/api/detect-vein",
            json=data
        )
        return response.json()

# 使用示例
api = VeinDetectionAPI()
result = api.upload_video("test_video.mp4", patient_id="P001")
print(result)
```

### JavaScript SDK

```javascript
class VeinDetectionAPI {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }
    
    async uploadVideo(videoFile, patientId = null, description = null) {
        const formData = new FormData();
        formData.append('file', videoFile);
        
        if (patientId) formData.append('patient_id', patientId);
        if (description) formData.append('description', description);
        
        const response = await fetch(`${this.baseUrl}/api/upload-video`, {
            method: 'POST',
            body: formData
        });
        
        return await response.json();
    }
    
    async getFrames(videoId, startFrame = 0, interval = 1) {
        const params = new URLSearchParams({
            start_frame: startFrame,
            interval: interval
        });
        
        const response = await fetch(
            `${this.baseUrl}/api/frames/${videoId}?${params}`
        );
        
        return await response.json();
    }
}

// 使用示例
const api = new VeinDetectionAPI();
const result = await api.uploadVideo(videoFile, 'P001');
console.log(result);
```