# 使用说明文档

本文档详细介绍静脉检测系统的使用方法，包括Web界面操作、API调用和最佳实践。

## 目录

- [系统概述](#系统概述)
- [Web界面使用](#web界面使用)
- [API接口使用](#api接口使用)
- [视频处理流程](#视频处理流程)
- [检测结果解读](#检测结果解读)
- [ROI管理](#roi管理)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

## 系统概述

静脉检测系统主要应用于医疗诊断、生物识别和研究分析领域。系统通过先进的图像处理和机器学习算法，从视频中识别和定位静脉结构。

### 适用场景

- **医疗诊断**: 静脉疾病筛查和诊断辅助
- **生物识别**: 静脉模式身份认证
- **学术研究**: 静脉结构分析和研究
- **培训教育**: 医学教学和演示

### 支持的视频格式

| 格式 | 扩展名 | 最大文件大小 | 推荐设置 |
|------|--------|--------------|----------|
| MP4 | .mp4 | 500MB | H.264编码，1080p |
| AVI | .avi | 500MB | 无损压缩 |
| MOV | .mov | 500MB | 高质量设置 |
| MKV | .mkv | 500MB | H.264编码 |

## Web界面使用

### 登录系统

1. 访问 http://localhost:3000
2. 输入用户名和密码
3. 点击"登录"按钮

> **注意**: 首次使用需要联系管理员创建账户

### 主界面介绍

```
┌─────────────────────────────────────────────────────────────┐
│ 顶部导航栏                                                  │
├─────────────────────────────────────────────────────────────┤
│ 侧边栏                    │           主工作区              │
│ - 项目列表                │                                │
│ - 视频管理                │       当前操作显示区域          │
│ - 检测结果                │                                │
│ - 系统设置                │                                │
└─────────────────────────────────────────────────────────────┘
```

### 视频上传

#### 步骤1: 准备视频文件

- 确保视频格式为支持的格式（MP4, AVI, MOV, MKV）
- 文件大小不超过500MB
- 建议视频长度2-5分钟，帧率30fps
- 拍摄时保持手部稳定，光线均匀

#### 步骤2: 上传操作

1. 点击侧边栏"视频管理"
2. 点击"上传视频"按钮
3. 选择视频文件
4. 填写视频信息：
   - **患者ID**: 可选，用于标识患者
   - **视频描述**: 描述拍摄部位和目的
   - **拍摄参数**: 可选，记录拍摄条件
5. 点击"上传"开始处理

#### 步骤3: 上传进度监控

```
上传进度: ████████████████ 80%
状态: 正在提取帧...
预计剩余时间: 30秒
```

#### 上传成功提示

```
✅ 视频上传成功
📹 视频ID: video_20231118_001
⏱️ 时长: 2分30秒
🎞️ 总帧数: 4500帧
📊 文件大小: 245MB
```

### 视频浏览

#### 视频列表

| 视频ID | 文件名 | 患者ID | 时长 | 状态 | 上传时间 | 操作 |
|--------|--------|--------|------|------|----------|------|
| video_001 | hand_vein.mp4 | P001 | 2:30 | 已处理 | 2025-11-18 | 查看/删除 |
| video_002 | arm_vein.avi | P002 | 1:45 | 处理中 | 2025-11-18 | 取消 |
| video_003 | wrist_scan.mov | - | 3:15 | 失败 | 2025-11-17 | 重试 |

#### 视频详情

1. 点击视频记录进入详情页
2. 查看基本信息：
   - 视频属性（分辨率、帧率、编码格式）
   - 存储路径
   - 处理状态
   - 统计信息

### 帧查看器

#### 帧导航

```
帧号: [0] [30] [60] [90] ...
     ↓
当前帧: 第60帧 (时间戳: 2.0秒)
```

#### 帧操作

- **播放控制**: 播放/暂停/停止
- **帧跳转**: 跳转到指定帧号
- **缩放**: 放大/缩小查看细节
- **对比**: 并排对比多个帧

#### 帧信息显示

- **基本属性**: 帧号、时间戳、分辨率
- **图像统计**: 亮度、对比度、直方图
- **检测结果**: 静脉检测标注（如果已处理）

## API接口使用

### 环境准备

#### 1. 获取API Token（如果需要）

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'
```

返回Token：
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
```

#### 2. 设置认证

```bash
export API_TOKEN="your_access_token_here"
```

### 完整工作流程示例

#### Step 1: 上传视频

```bash
# 使用curl上传
curl -X POST http://localhost:8000/api/upload-video \
  -H "Authorization: Bearer $API_TOKEN" \
  -F "file=@/path/to/vein_video.mp4" \
  -F "patient_id=P001" \
  -F "description=左手静脉检测视频"

# 返回结果
{
  "success": true,
  "data": {
    "video_id": "video_20231118_001",
    "status": "uploaded",
    "upload_time": "2025-11-18T08:32:40Z"
  }
}
```

#### Step 2: 获取视频信息

```bash
curl -X GET "http://localhost:8000/api/video/info/video_20231118_001" \
  -H "Authorization: Bearer $API_TOKEN"
```

#### Step 3: 获取帧列表

```bash
curl -X GET "http://localhost:8000/api/frames/video_20231118_001?interval=30" \
  -H "Authorization: Bearer $API_TOKEN"
```

#### Step 4: 开始检测

```bash
# 提交检测任务
curl -X POST http://localhost:8000/api/detect-vein \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "video_20231118_001",
    "frame_numbers": [0, 30, 60, 90],
    "algorithm": "advanced",
    "parameters": {
      "sensitivity": 0.8,
      "contrast_enhancement": true
    }
  }'
```

#### Step 5: 轮询检测状态

```bash
# 检查任务状态
curl -X GET "http://localhost:8000/api/task/status/detection_20231118_001" \
  -H "Authorization: Bearer $API_TOKEN"

# 轮询直到完成
while true; do
  status=$(curl -s -X GET "http://localhost:8000/api/task/status/detection_20231118_001" \
    -H "Authorization: Bearer $API_TOKEN" | jq -r '.data.status')
  
  if [ "$status" = "completed" ]; then
    echo "检测完成"
    break
  elif [ "$status" = "failed" ]; then
    echo "检测失败"
    exit 1
  else
    echo "检测进行中...状态: $status"
    sleep 5
  fi
done
```

#### Step 6: 获取检测结果

```bash
curl -X GET "http://localhost:8000/api/detection-results?video_id=video_20231118_001" \
  -H "Authorization: Bearer $API_TOKEN"
```

### Python SDK使用示例

```python
from vein_detection import VeinDetectionAPI
import time

# 初始化客户端
api = VeinDetectionAPI(
    base_url="http://localhost:8000",
    token="your_access_token"
)

def main():
    try:
        # 1. 上传视频
        print("1. 上传视频...")
        video_id = api.upload_video(
            video_path="vein_video.mp4",
            patient_id="P001",
            description="左手静脉检测"
        )
        print(f"视频上传成功，ID: {video_id}")
        
        # 2. 获取帧列表
        print("2. 获取帧列表...")
        frames = api.get_frames(video_id, interval=30)
        frame_numbers = [f['frame_number'] for f in frames['data']['frames']]
        print(f"获取到 {len(frame_numbers)} 个关键帧")
        
        # 3. 开始检测
        print("3. 开始静脉检测...")
        task_id = api.detect_vein(
            video_id=video_id,
            frame_numbers=frame_numbers[:10],  # 仅检测前10帧作为示例
            algorithm="advanced"
        )
        print(f"检测任务已提交，任务ID: {task_id}")
        
        # 4. 等待检测完成
        print("4. 等待检测完成...")
        while True:
            status = api.get_task_status(task_id)
            if status == "completed":
                print("✅ 检测完成")
                break
            elif status == "failed":
                print("❌ 检测失败")
                return
            else:
                print(f"🔄 检测进行中... ({status})")
                time.sleep(5)
        
        # 5. 获取结果
        print("5. 获取检测结果...")
        results = api.get_detection_results(video_id)
        
        # 6. 输出结果摘要
        print("\n=== 检测结果摘要 ===")
        for frame_result in results['data']['frame_results']:
            frame_num = frame_result['frame_number']
            vein_points = frame_result['vein_detection']['vein_points']
            avg_confidence = frame_result['vein_detection']['avg_confidence']
            print(f"帧 {frame_num}: {vein_points} 个静脉点, 平均置信度: {avg_confidence:.2f}")
        
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    main()
```

### JavaScript/Node.js使用示例

```javascript
const VeinDetectionAPI = require('vein-detection-sdk');

async function main() {
    const api = new VeinDetectionAPI({
        baseUrl: 'http://localhost:8000',
        token: 'your_access_token'
    });

    try {
        // 1. 上传视频
        console.log('1. 上传视频...');
        const uploadResult = await api.uploadVideo(
            './vein_video.mp4',
            'P001',
            '左手静脉检测'
        );
        const videoId = uploadResult.data.video_id;
        console.log(`视频上传成功，ID: ${videoId}`);

        // 2. 获取帧列表
        console.log('2. 获取帧列表...');
        const frames = await api.getFrames(videoId, { interval: 30 });
        const frameNumbers = frames.data.frames.map(f => f.frame_number);
        console.log(`获取到 ${frameNumbers.length} 个关键帧`);

        // 3. 开始检测
        console.log('3. 开始静脉检测...');
        const taskId = await api.detectVein({
            videoId,
            frameNumbers: frameNumbers.slice(0, 10), // 仅检测前10帧
            algorithm: 'advanced'
        });
        console.log(`检测任务已提交，任务ID: ${taskId}`);

        // 4. 轮询检测状态
        console.log('4. 等待检测完成...');
        let status;
        do {
            status = await api.getTaskStatus(taskId);
            if (status === 'completed') {
                console.log('✅ 检测完成');
                break;
            } else if (status === 'failed') {
                console.log('❌ 检测失败');
                return;
            } else {
                console.log(`🔄 检测进行中... (${status})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } while (true);

        // 5. 获取结果
        console.log('5. 获取检测结果...');
        const results = await api.getDetectionResults(videoId);

        // 6. 输出结果
        console.log('\n=== 检测结果摘要 ===');
        results.data.frameResults.forEach(frameResult => {
            console.log(
                `帧 ${frameResult.frameNumber}: ` +
                `${frameResult.veinDetection.veinPoints} 个静脉点, ` +
                `平均置信度: ${frameResult.veinDetection.avgConfidence.toFixed(2)}`
            );
        });

    } catch (error) {
        console.error('错误:', error);
    }
}

main();
```

## 视频处理流程

### 1. 视频预处理

#### 质量检查

- **分辨率检查**: 最低720p，推荐1080p+
- **帧率检查**: 建议30fps，范围20-60fps
- **时长检查**: 建议2-5分钟
- **压缩质量**: 检查视频压缩程度，避免过度压缩

#### 格式转换（如果需要）

```bash
# 使用FFmpeg转换视频格式
ffmpeg -i input.avi -c:v libx264 -crf 23 -preset medium output.mp4

# 调整分辨率
ffmpeg -i input.mp4 -vf scale=1920:1080 output_1080p.mp4

# 调整帧率
ffmpeg -i input.mp4 -r 30 output_30fps.mp4
```

### 2. 帧提取策略

#### 智能采样

- **均匀采样**: 按固定间隔提取帧
- **关键帧检测**: 基于内容变化选择重要帧
- **运动检测**: 检测大幅运动变化时的帧

#### 参数配置

```python
# 采样配置示例
sampling_config = {
    "method": "intelligent",  # uniform, intelligent, motion
    "base_interval": 30,      # 基础间隔（30帧=1秒）
    "keyframe_threshold": 0.3, # 关键帧阈值
    "max_frames": 1000,       # 最大帧数限制
    "min_confidence": 0.8     # 最小置信度
}
```

### 3. 静脉检测算法

#### 检测流程

1. **图像预处理**
   - 噪声降低
   - 对比度增强
   - 边缘锐化

2. **特征提取**
   - 静脉纹理分析
   - 血管分布模式
   - 深度特征计算

3. **检测与定位**
   - 候选区域生成
   - 置信度评估
   - 非极大值抑制

4. **后处理**
   - 连通性分析
   - 形态学优化
   - 区域合并

#### 算法参数调优

```python
# 检测参数配置
detection_params = {
    "sensitivity": 0.8,           # 检测敏感度 (0.0-1.0)
    "min_vein_length": 10,        # 最小静脉长度（像素）
    "max_vein_width": 5,          # 最大静脉宽度（像素）
    "contrast_threshold": 0.3,    # 对比度阈值
    "noise_tolerance": 0.2,       # 噪声容忍度
    "enable_smoothing": True,     # 启用平滑处理
    "enable_enhancement": True    # 启用增强处理
}
```

## 检测结果解读

### 结果数据结构

```json
{
  "frame_results": [
    {
      "frame_number": 0,
      "detection_status": "completed",
      "vein_detection": {
        "vein_points": 15,
        "confidence_distribution": {
          "high": 8,    # 置信度 > 0.8
          "medium": 5,  # 置信度 0.5-0.8
          "low": 2      # 置信度 < 0.5
        },
        "analysis_metrics": {
          "vein_clarity": 0.87,        # 静脉清晰度
          "contrast_ratio": 0.42,      # 对比度比率
          "signal_noise_ratio": 15.2,  # 信噪比
          "uniformity_score": 0.73     # 均匀性评分
        }
      },
      "roi_data": {
        "active_rois": 3,
        "total_rois": 5,
        "coverage_ratio": 0.85
      }
    }
  ]
}
```

### 指标说明

#### 置信度等级

- **High (高)**: > 0.8 - 检测结果非常可靠
- **Medium (中)**: 0.5-0.8 - 检测结果较可靠
- **Low (低)**: < 0.5 - 检测结果不确定

#### 分析指标

| 指标 | 范围 | 说明 | 推荐值 |
|------|------|------|--------|
| Vein Clarity | 0-1 | 静脉清晰度 | > 0.7 |
| Contrast Ratio | 0-1 | 对比度比率 | > 0.3 |
| Signal Noise Ratio | 0-∞ | 信噪比 | > 10 |
| Uniformity Score | 0-1 | 均匀性评分 | > 0.6 |

### 结果可视化

#### 标注图像

系统会生成带标注的图像，用不同颜色标识检测结果：

- **红色**: 高置信度静脉
- **橙色**: 中等置信度静脉  
- **黄色**: 低置信度静脉
- **蓝色**: ROI区域
- **绿色**: 参考点

#### 统计图表

- **置信度分布图**: 显示各置信度等级的静脉点数量
- **时间序列图**: 展示静脉检测随时间的变化
- **热力图**: 显示静脉密度分布
- **3D可视化**: 立体展示静脉结构

## ROI管理

### ROI类型

#### 1. 静脉区域 (Vein Region)

```json
{
  "type": "vein_region",
  "purpose": "主要检测区域",
  "priority": 1,
  "properties": {
    "vein_type": "radial_vein",
    "expected_clarity": "high",
    "detection_focus": "primary"
  }
}
```

#### 2. 参考点 (Reference Point)

```json
{
  "type": "reference_point", 
  "purpose": "校准和定位",
  "priority": 2,
  "properties": {
    "reference_type": "anatomical",
    "stability": "high"
  }
}
```

#### 3. 排除区域 (Exclusion Area)

```json
{
  "type": "exclusion_area",
  "purpose": "避免误检测",
  "priority": 3,
  "properties": {
    "exclusion_reason": "motion_artifacts",
    "confidence_threshold": 0.9
  }
}
```

### ROI创建流程

#### 手动创建

1. 在帧查看器中选择帧
2. 点击"添加ROI"按钮
3. 绘制ROI区域
4. 配置ROI属性
5. 保存ROI设置

#### 自动检测

```python
# 使用算法自动检测ROI
roi_detection_config = {
    "method": "auto_detect",
    "algorithm": "contour_analysis",
    "parameters": {
        "min_area": 1000,      # 最小区域面积
        "max_area": 50000,     # 最大区域面积
        "aspect_ratio": [0.5, 2.0], # 纵横比范围
        "confidence_threshold": 0.7
    }
}
```

### ROI应用

#### 检测时应用ROI

```python
# 检测配置中应用ROI
detection_config = {
    "use_roi": True,
    "roi_strategy": "focus",    # focus, exclude, weight
    "roi_expansion": 10,        # ROI扩展像素
    "weight_multiplier": 1.5    # ROI内权重倍数
}
```

#### ROI效果优化

- **focus**: 专注于ROI内检测
- **exclude**: 排除ROI外检测  
- **weight**: ROI内加权检测

## 最佳实践

### 视频拍摄建议

#### 拍摄环境

- **光线**: 充足且均匀的照明，避免强反射
- **背景**: 纯色背景，对比明显
- **稳定**: 使用支架固定，避免抖动
- **距离**: 保持适当距离，确保静脉清晰可见

#### 拍摄技巧

```markdown
✅ 推荐做法:
- 手部放松，自然放置
- 从多个角度拍摄
- 保持恒定的光线
- 避免手指压迫
- 拍摄时长2-5分钟

❌ 避免做法:
- 手部过度压迫
- 强烈的阴影
- 背景杂乱
- 快速移动
- 过度压缩视频
```

### 参数调优指南

#### 根据视频质量调整

**高质量视频** (清晰、对比度高):
```python
detection_params = {
    "sensitivity": 0.9,
    "min_vein_length": 8,
    "noise_tolerance": 0.1,
    "enable_smoothing": False
}
```

**中等质量视频**:
```python
detection_params = {
    "sensitivity": 0.7,
    "min_vein_length": 12,
    "noise_tolerance": 0.3,
    "enable_smoothing": True
}
```

**低质量视频** (模糊、对比度低):
```python
detection_params = {
    "sensitivity": 0.5,
    "min_vein_length": 15,
    "noise_tolerance": 0.4,
    "enable_enhancement": True,
    "enhancement_strength": 1.2
}
```

### 性能优化建议

#### 批处理优化

```python
# 合理设置批处理大小
batch_config = {
    "batch_size": 8,        # 根据GPU内存调整
    "max_concurrent": 4,    # 并发任务数
    "memory_limit": "8GB",  # 内存限制
    "timeout": 300          # 任务超时时间（秒）
}
```

#### 缓存策略

```python
# 启用多层缓存
cache_config = {
    "frame_cache": True,      # 帧缓存
    "result_cache": True,     # 结果缓存
    "model_cache": True,      # 模型缓存
    "cache_size": "2GB",      # 缓存大小
    "ttl": 3600              # 缓存过期时间（秒）
}
```

### 错误处理

#### 常见错误及解决方案

**视频上传失败**
```bash
# 检查文件大小
ls -lh video.mp4

# 检查网络连接
ping localhost:8000

# 查看服务日志
docker-compose logs -f api
```

**检测失败**
```bash
# 检查GPU状态
nvidia-smi

# 验证模型文件
ls -la /models/vein_detection.pth

# 查看检测日志
tail -f /var/log/detection.log
```

#### 重试策略

```python
# 自动重试配置
retry_config = {
    "max_retries": 3,
    "retry_delay": 5,        # 重试间隔（秒）
    "backoff_factor": 2,     # 退避因子
    "retry_on_errors": [
        "DETECTION_FAILED",
        "TIMEOUT", 
        "MEMORY_INSUFFICIENT"
    ]
}
```

## 故障排除

### 诊断工具

#### 系统状态检查

```bash
# 检查所有服务状态
curl http://localhost:8000/health

# 检查数据库连接
psql -h localhost -U vein_user -d vein_detection -c "SELECT 1;"

# 检查Redis连接
redis-cli ping

# 检查存储空间
df -h /data
```

#### 日志分析

```bash
# 查看应用日志
docker-compose logs -f --tail=100 api

# 查看错误日志
grep -i error /var/log/vein_detection.log | tail -20

# 性能分析日志
grep -i "processing_time" /var/log/vein_detection.log | tail -10
```

### 性能监控

#### 关键指标

- **API响应时间**: < 200ms
- **检测速度**: < 3s/帧
- **内存使用**: < 8GB
- **CPU使用率**: < 80%
- **GPU使用率**: < 90%

#### 监控脚本

```bash
#!/bin/bash
# 性能监控脚本

echo "=== 系统性能监控 ==="
echo "时间: $(date)"

# CPU使用率
echo "CPU使用率:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print "User: " $1 "%, System: " $3 "%"}'

# 内存使用
echo "内存使用:"
free -h | awk 'NR==2{printf "Total: %s, Used: %s (%.2f%%), Free: %s\n", $2,$3,$3*100/$2,$7}'

# GPU状态
if command -v nvidia-smi &> /dev/null; then
    echo "GPU状态:"
    nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu --format=csv,noheader,nounits
fi

# API服务
echo "API服务状态:"
curl -s -o /dev/null -w "HTTP状态: %{http_code}, 响应时间: %{time_total}s\n" http://localhost:8000/health
```

---

如需更多帮助，请联系技术支持团队或查看项目文档。