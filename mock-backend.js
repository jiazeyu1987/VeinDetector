const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      video_processor: 'ok',
      vein_detector: 'ok',
      roi_handler: 'ok'
    }
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: "超声静脉检测系统API 正在运行",
    data: {
      version: "1.0.0",
      endpoints: {
        upload: "/upload-video",
        status: "/processing-status/{task_id}",
        settings: "/detection-settings",
        docs: "/docs"
      }
    }
  });
});

// SAMUS 分析接口
app.post('/analysis/samus', (req, res) => {
  console.log('🔄 收到分析请求:', {
    timestamp: new Date().toLocaleTimeString(),
    modelName: req.body.model_name,
    hasParameters: !!req.body.parameters,
    parameterCount: req.body.parameters ? Object.keys(req.body.parameters).length : 0,
    roi: req.body.roi,
    parameters: req.body.parameters
  });

  try {
    const { image_data_url, roi, model_name, parameters } = req.body;

    // 验证必要参数
    if (!image_data_url || !roi || !model_name) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: image_data_url, roi, model_name'
      });
    }

    // 模拟图像处理时间
    setTimeout(() => {
      // 创建一个简单的测试掩码
      const width = Math.round(roi.width);
      const height = Math.round(roi.height);

      // 生成测试掩码 - 在ROI中心创建一个椭圆形区域
      const mask = [];
      for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
          // 椭圆方程
          const cx = width / 2;
          const cy = height / 2;
          const rx = width / 3;
          const ry = height / 3;

          const distance = Math.sqrt(Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2));
          row.push(distance <= 1 ? 1 : 0);
        }
        mask.push(row);
      }

      // 定义ROI中心采样点（用于连通域判定）
      const centerPoints = [
        { x: Math.round(width * 0.25), y: Math.round(height * 0.25), label: '左上' },
        { x: Math.round(width * 0.25), y: Math.round(height * 0.75), label: '左下' },
        { x: Math.round(width * 0.5), y: Math.round(height * 0.5), label: '中心' },
        { x: Math.round(width * 0.75), y: Math.round(height * 0.25), label: '右上' },
        { x: Math.round(width * 0.75), y: Math.round(height * 0.75), label: '右下' }
      ];

      console.log('🎯 ROI采样点坐标和状态:');
      centerPoints.forEach(point => {
        const inMask = point.y < height && point.x < width && mask[point.y][point.x] === 1;
        console.log(`  ${point.label}点(${point.x},${point.y}): ${inMask ? '✅在mask内' : '❌不在mask内'}`);
      });

      // 如果启用了ROI中心点连通域，只保留中心区域的mask
      let roiCenterConnected = false;
      if (parameters && parameters.roi_center_connected_component_enabled === 1) {
        console.log('✅ ROI中心点连通域已启用 - 检查中心点是否在mask内');
        roiCenterConnected = true;

        // 检查中心点是否在mask内
        const centerPoint = centerPoints[2]; // 中心点
        const centerInMask = centerPoint.y < height && centerPoint.x < width && mask[centerPoint.y][centerPoint.x] === 1;

        if (centerInMask) {
          console.log('✅ 中心点在mask内，保留整个mask');
        } else {
          console.log('❌ 中心点不在mask内，清空mask');
          // 清空mask
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              mask[y][x] = 0;
            }
          }
        }
      } else {
        console.log('❌ ROI中心点连通域未启用');
      }

      // 如果启用了最大连通域，只保留最大的连通区域
      let maxConnectedComponent = false;
      if (parameters && parameters.max_connected_component_enabled === 1) {
        console.log('✅ 最大连通域已启用 - 保留最大连通区域');
        maxConnectedComponent = true;
        // 简单的连通域保留（这里简化处理）
        const totalPixels = mask.flat().reduce((sum, val) => sum + val, 0);
        console.log(`📊 生成mask包含 ${totalPixels} 个像素点`);
      }

      // 如果启用了选中点连通域，只保留选中点所在的连通区域
      let selectedPointConnected = false;
      if (parameters && parameters.selected_point_connected_component_enabled === 1) {
        const selectedX = parameters.selected_point_x || 0;
        const selectedY = parameters.selected_point_y || 0;

        // 详细日志：ROI和选中点信息
        console.log(`🎯 ========== 选中点连通域检测开始 ==========`);
        console.log(`📍 ROI位置: x=${roi.x}, y=${roi.y}, width=${roi.width}, height=${roi.height}`);
        console.log(`🎯 选中点位置: (${selectedX}, ${selectedY}) (相对于ROI坐标系)`);
        console.log(`📐 选中点绝对坐标: (${roi.x + selectedX}, ${roi.y + selectedY}) (相对于全图)`);
        console.log(`🔍 Mask尺寸: ${width} x ${height}`);

        // 计算原始mask的大小
        const originalPixels = mask.flat().reduce((sum, val) => sum + val, 0);
        console.log(`📊 过滤前Mask包含 ${originalPixels} 个像素点`);

        if (selectedX >= 0 && selectedY >= 0 && selectedX < width && selectedY < height) {
          console.log(`✅ 选中点坐标有效，开始处理连通域`);
          selectedPointConnected = true;

          // 检查选中点是否在mask内
          const pointInMask = mask[selectedY][selectedX] === 1;
          console.log(`🔍 关键点(${selectedX}, ${selectedY})是否在Mask内: ${pointInMask ? '✅ 是' : '❌ 否'}`);

          if (pointInMask) {
            console.log(`✅ 选中点在mask内，保留该点所在的连通域`);

            // 简化的连通域查找：找到所有包含选中点的连通区域
            const visited = Array(height).fill().map(() => Array(width).fill(false));
            const newMask = Array(height).fill().map(() => Array(width).fill(0));
            let componentSize = 0;

            // 使用BFS查找选中点所在的连通域
            const queue = [[selectedY, selectedX]];
            visited[selectedY][selectedX] = true;

            console.log(`🔍 开始BFS搜索连通域...`);
            while (queue.length > 0) {
              const [y, x] = queue.shift();
              newMask[y][x] = 1;
              componentSize++;

              // 检查四个方向的邻居
              const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
              for (const [dy, dx] of directions) {
                const ny = y + dy;
                const nx = x + dx;
                if (ny >= 0 && ny < height && nx >= 0 && nx < width &&
                    !visited[ny][nx] && mask[ny][nx] === 1) {
                  visited[ny][nx] = true;
                  queue.push([ny, nx]);
                }
              }
            }

            // 替换mask
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                mask[y][x] = newMask[y][x];
              }
            }

            const retainedPixels = mask.flat().reduce((sum, val) => sum + val, 0);
            console.log(`🎯 关键点所在连通域大小: ${componentSize} 个像素点`);
            console.log(`📊 过滤后Mask包含 ${retainedPixels} 个像素点`);
            console.log(`📈 保留率: ${((retainedPixels / originalPixels) * 100).toFixed(2)}%`);
            console.log(`✅ 选中点连通域处理完成`);
          } else {
            console.log(`❌ 选中点不在mask内，清空mask`);
            // 清空mask
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                mask[y][x] = 0;
              }
            }
            const clearedPixels = mask.flat().reduce((sum, val) => sum + val, 0);
            console.log(`📊 清空后Mask包含 ${clearedPixels} 个像素点`);
          }
        } else {
          console.log(`⚠️ 选中点坐标无效: (${selectedX}, ${selectedY})`);
          console.log(`📐 有效坐标范围: x∈[0,${width-1}], y∈[0,${height-1}]`);
        }
        console.log(`🎯 ========== 选中点连通域检测结束 ==========`);
      }

      console.log('✅ 分析完成 - 生成mask尺寸:', width, 'x', height);

      res.json({
        success: true,
        message: `${model_name} 分割完成`,
        data: {
          width: width,
          height: height,
          mask: mask,
          // 添加中心点信息供前端显示
          centerPoints: centerPoints,
          roiCenterConnected: roiCenterConnected,
          maxConnectedComponent: maxConnectedComponent,
          selectedPointConnected: selectedPointConnected,
          processingInfo: {
            algorithm: model_name,
            roiSize: `${width}x${height}`,
            totalPixels: mask.flat().reduce((sum, val) => sum + val, 0),
            roiCenterConnectedEnabled: parameters?.roi_center_connected_component_enabled === 1,
            maxConnectedComponentEnabled: parameters?.max_connected_component_enabled === 1,
            selectedPointConnectedComponentEnabled: parameters?.selected_point_connected_component_enabled === 1,
            selectedPoint: parameters?.selected_point_connected_component_enabled === 1
              ? { x: parameters?.selected_point_x || 0, y: parameters?.selected_point_y || 0 }
              : null
          }
        }
      });
    }, 1000); // 模拟1秒处理时间

  } catch (error) {
    console.error('❌ 分析失败:', error);
    res.status(500).json({
      success: false,
      message: '分析失败: ' + error.message
    });
  }
});

// 检测设置接口
app.get('/detection-settings', (req, res) => {
  res.json({
    blurKernelSize: 5,
    claheClipLimit: 2.5,
    claheTileGridSize: 8,
    frangiScaleMin: 1.0,
    frangiScaleMax: 3.0,
    frangiScaleStep: 0.5,
    frangiThreshold: 0.08,
    areaMin: 100,
    areaMax: 4000,
    aspectRatioMin: 0.5,
    aspectRatioMax: 2.0,
    centerBandTop: 0.3,
    centerBandBottom: 0.9,
    morphKernelSize: 5,
    morphCloseIterations: 2,
    morphOpenIterations: 1,
    confidenceThreshold: 0.5,
    ellipticalConstraintEnabled: true,
    maxConnectedComponentEnabled: true,
    roiCenterConnectedComponentEnabled: true,
    ellipticalMorphParams: {
      thresholdMin: 50,
      thresholdMax: 150,
      ellipseMajorAxis: 30,
      ellipseMinorAxis: 20,
      ellipseAngle: 0,
      morphStrength: 3,
      blurKernelSize: 5,
      claheClipLimit: 2.5,
      claheTileGridSize: 8
    },
    simpleCenterParams: {
      blurKernelSize: 5,
      claheClipLimit: 2.5,
      claheTileGridSize: 8,
      morphKernelSize: 5,
      morphCloseIterations: 2,
      morphOpenIterations: 1,
      areaMinFactor: 0.1,
      areaMaxFactor: 3.0,
      circularityMin: 0.3
    }
  });
});

app.put('/detection-settings', (req, res) => {
  console.log('📝 更新检测设置:', req.body);
  res.json({
    success: true,
    message: '检测设置更新成功',
    data: req.body
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 模拟后端服务器启动成功!`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📍 健康检查: http://localhost:${PORT}/health`);
  console.log(`📍 API文档: http://localhost:${PORT}/docs`);
  console.log('');
  console.log('✅ 可以开始测试前端分析功能了!');
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});