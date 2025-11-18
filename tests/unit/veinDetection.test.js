// 静脉检测功能测试用例
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  VeinDetector, 
  DetectionAlgorithm, 
  ROIProcessor, 
  validateDetectionParams,
  processVideoFrame,
  extractVeinFeatures
} from '../src/veinDetection';

describe('静脉检测功能测试', () => {
  let veinDetector: VeinDetector;
  const mockVideoFrame = createMockVideoFrame();

  beforeEach(() => {
    veinDetector = new VeinDetector({
      algorithm: 'adaptive_thresholding',
      sensitivity: 0.8,
      roiSize: { width: 200, height: 200 }
    });
  });

  describe('基础检测功能', () => {
    test('静脉检测算法初始化', () => {
      expect(veinDetector).toBeDefined();
      expect(veinDetector.algorithm).toBe('adaptive_thresholding');
      expect(veinDetector.sensitivity).toBe(0.8);
    });

    test('检测参数验证 - 正常参数', () => {
      const validParams = {
        algorithm: 'sobel_edge',
        sensitivity: 0.7,
        roiSize: { width: 150, height: 150 },
        contrast: 1.2,
        brightness: 10
      };

      const validation = validateDetectionParams(validParams);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('检测参数验证 - 无效参数', () => {
      const invalidParams = {
        algorithm: 'invalid_algorithm',
        sensitivity: 1.5, // 超出范围
        roiSize: { width: -100, height: 0 },
        contrast: -1,
        brightness: 300
      };

      const validation = validateDetectionParams(invalidParams);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('视频帧处理 - 单帧检测', async () => {
      const detectionResult = await processVideoFrame(mockVideoFrame, {
        algorithm: 'adaptive_thresholding',
        sensitivity: 0.8
      });

      expect(detectionResult.success).toBe(true);
      expect(detectionResult.detectionData).toBeDefined();
      expect(detectionResult.confidence).toBeGreaterThanOrEqual(0);
      expect(detectionResult.confidence).toBeLessThanOrEqual(1);
      expect(detectionResult.veinPoints).toBeDefined();
      expect(Array.isArray(detectionResult.veinPoints)).toBe(true);
    });
  });

  describe('ROI区域处理', () => {
    test('ROI提取 - 正常区域', () => {
      const roi = {
        x: 100,
        y: 100,
        width: 200,
        height: 200
      };

      const processor = new ROIProcessor();
      const extractedRoi = processor.extractROI(mockVideoFrame, roi);

      expect(extractedRoi).toBeDefined();
      expect(extractedRoi.width).toBe(200);
      expect(extractedRoi.height).toBe(200);
      expect(extractedRoi.data).toBeDefined();
    });

    test('ROI提取 - 边界检查', () => {
      const roi = {
        x: -50,
        y: -50,
        width: 300,
        height: 300
      };

      const processor = new ROIProcessor();
      const extractedRoi = processor.extractROI(mockVideoFrame, roi);

      // 应该自动调整边界
      expect(extractedRoi.x).toBeGreaterThanOrEqual(0);
      expect(extractedRoi.y).toBeGreaterThanOrEqual(0);
      expect(extractedRoi.width).toBeLessThanOrEqual(mockVideoFrame.width);
      expect(extractedRoi.height).toBeLessThanOrEqual(mockVideoFrame.height);
    });

    test('ROI交互 - 手动调整', () => {
      const processor = new ROIProcessor();
      
      const initialRoi = { x: 100, y: 100, width: 200, height: 200 };
      const adjustment = { dx: 20, dy: -10, dw: 30, dh: -15 };

      const adjustedRoi = processor.adjustROI(initialRoi, adjustment);
      
      expect(adjustedRoi.x).toBe(120);
      expect(adjustedRoi.y).toBe(90);
      expect(adjustedRoi.width).toBe(230);
      expect(adjustedRoi.height).toBe(185);
    });

    test('ROI有效性验证', () => {
      const processor = new ROIProcessor();
      
      const validRoi = { x: 50, y: 50, width: 100, height: 100 };
      const invalidRoi = { x: 500, y: 500, width: 200, height: 200 }; // 超出图像范围

      expect(processor.validateROI(validRoi, mockVideoFrame)).toBe(true);
      expect(processor.validateROI(invalidRoi, mockVideoFrame)).toBe(false);
    });
  });

  describe('检测算法性能', () => {
    test('自适应阈值算法', async () => {
      const result = await veinDetector.detectVeins(mockVideoFrame, {
        algorithm: 'adaptive_thresholding'
      });

      expect(result.algorithm).toBe('adaptive_thresholding');
      expect(result.detectionTime).toBeLessThan(100); // 100ms内完成
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('Sobel边缘检测算法', async () => {
      const result = await veinDetector.detectVeins(mockVideoFrame, {
        algorithm: 'sobel_edge'
      });

      expect(result.algorithm).toBe('sobel_edge');
      expect(result.detectionTime).toBeLessThan(150);
      expect(result.veinSegments).toBeDefined();
      expect(Array.isArray(result.veinSegments)).toBe(true);
    });

    test('Canny边缘检测算法', async () => {
      const result = await veinDetector.detectVeins(mockVideoFrame, {
        algorithm: 'canny_edge'
      });

      expect(result.algorithm).toBe('canny_edge');
      expect(result.detectionTime).toBeLessThan(200);
      expect(result.edgeMap).toBeDefined();
      expect(result.veinPoints.length).toBeGreaterThan(0);
    });

    test('多算法组合检测', async () => {
      const result = await veinDetector.detectVeins(mockVideoFrame, {
        algorithm: 'combined',
        algorithms: ['adaptive_thresholding', 'sobel_edge', 'canny_edge'],
        fusionMethod: 'weighted_average'
      });

      expect(result.algorithm).toBe('combined');
      expect(result.detectionTime).toBeLessThan(300);
      expect(result.fusionConfidence).toBeGreaterThan(result.confidence);
    });
  });

  describe('特征提取和分析', () => {
    test('静脉特征提取', async () => {
      const features = await extractVeinFeatures(mockVideoFrame);

      expect(features).toBeDefined();
      expect(features.veinDensity).toBeGreaterThanOrEqual(0);
      expect(features.veinThickness).toBeDefined();
      expect(features.veinCurvature).toBeDefined();
      expect(features.contrastRatio).toBeGreaterThan(0);
      expect(features.textureFeatures).toBeDefined();
    });

    test('静脉拓扑分析', async () => {
      const detectionResult = await veinDetector.detectVeins(mockVideoFrame);
      const topology = veinDetector.analyzeTopology(detectionResult);

      expect(topology).toBeDefined();
      expect(topology.nodeCount).toBeGreaterThan(0);
      expect(topology.branchCount).toBeGreaterThan(0);
      expect(topology.cycleCount).toBeGreaterThanOrEqual(0);
      expect(topology.connectedComponents).toBeDefined();
    });

    test('置信度评估', async () => {
      const result = await veinDetector.detectVeins(mockVideoFrame);
      const confidenceAssessment = veinDetector.assessConfidence(result);

      expect(confidenceAssessment.overall).toBeGreaterThanOrEqual(0);
      expect(confidenceAssessment.overall).toBeLessThanOrEqual(1);
      expect(confidenceAssessment.factors).toBeDefined();
      expect(Array.isArray(confidenceAssessment.factors)).toBe(true);
    });
  });

  describe('性能优化测试', () => {
    test('实时检测性能', async () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        await veinDetector.detectVeins(mockVideoFrame);
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / 10;
      
      expect(averageTime).toBeLessThan(50); // 平均50ms内完成
    });

    test('内存使用监控', async () => {
      const initialMemory = process.memoryUsage();
      
      // 连续检测多帧
      for (let i = 0; i < 100; i++) {
        await veinDetector.detectVeins(mockVideoFrame);
        
        // 强制垃圾回收（在测试环境中）
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB内
    });

    test('缓存机制效果', async () => {
      const frameWithSameContent = { ...mockVideoFrame };
      
      const start1 = performance.now();
      await veinDetector.detectVeins(frameWithSameContent);
      const time1 = performance.now() - start1;
      
      const start2 = performance.now();
      await veinDetector.detectVeins(frameWithSameContent);
      const time2 = performance.now() - start2;
      
      // 第二次应该更快（缓存命中）
      expect(time2).toBeLessThan(time1 * 0.8);
    });
  });

  describe('错误处理和边界情况', () => {
    test('无效输入处理', async () => {
      const invalidFrame = null;
      
      await expect(
        veinDetector.detectVeins(invalidFrame)
      ).rejects.toThrow('无效的视频帧');
    });

    test('低质量图像处理', async () => {
      const lowQualityFrame = createLowQualityVideoFrame();
      const result = await veinDetector.detectVeins(lowQualityFrame);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeLessThan(0.5); // 置信度应该较低
      expect(result.warnings).toContain('图像质量较低');
    });

    test('过曝图像处理', async () => {
      const overexposedFrame = createOverexposedVideoFrame();
      const result = await veinDetector.detectVeins(overexposedFrame);
      
      expect(result.success).toBe(true);
      expect(result.adjustments).toBeDefined();
      expect(result.adjustments.brightness).toBeLessThan(0);
      expect(result.adjustments.contrast).toBeLessThan(0);
    });

    test('欠曝图像处理', async () => {
      const underexposedFrame = createUnderexposedVideoFrame();
      const result = await veinDetector.detectVeins(underexposedFrame);
      
      expect(result.success).toBe(true);
      expect(result.adjustments).toBeDefined();
      expect(result.adjustments.brightness).toBeGreaterThan(0);
      expect(result.adjustments.contrast).toBeGreaterThan(0);
    });
  });
});

// 辅助函数和模拟数据
function createMockVideoFrame() {
  return {
    width: 640,
    height: 480,
    data: Buffer.alloc(640 * 480 * 4), // RGBA
    timestamp: Date.now(),
    frameNumber: 1
  };
}

function createLowQualityVideoFrame() {
  return {
    width: 160,
    height: 120,
    data: Buffer.alloc(160 * 120 * 4),
    timestamp: Date.now(),
    frameNumber: 1,
    quality: 0.3
  };
}

function createOverexposedVideoFrame() {
  const frame = createMockVideoFrame();
  frame.data.fill(255); // 全白
  return {
    ...frame,
    exposure: 'overexposed'
  };
}

function createUnderexposedVideoFrame() {
  const frame = createMockVideoFrame();
  frame.data.fill(0); // 全黑
  return {
    ...frame,
    exposure: 'underexposed'
  };
}

// 模拟实现
export class VeinDetector {
  constructor(options: any) {
    this.algorithm = options.algorithm;
    this.sensitivity = options.sensitivity;
    this.roiSize = options.roiSize;
  }

  async detectVeins(frame: any, options?: any) {
    // 模拟检测过程
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
    
    return {
      success: true,
      algorithm: options?.algorithm || this.algorithm,
      detectionTime: Math.random() * 100 + 20,
      confidence: Math.random() * 0.8 + 0.2,
      veinPoints: generateMockVeinPoints(),
      veinSegments: generateMockVeinSegments(),
      edgeMap: Buffer.alloc(10),
      fusionConfidence: Math.random() * 0.9 + 0.1,
      adjustments: {
        brightness: Math.random() * 0.2 - 0.1,
        contrast: Math.random() * 0.2 - 0.1
      },
      warnings: []
    };
  }

  analyzeTopology(detectionData: any) {
    return {
      nodeCount: Math.floor(Math.random() * 10) + 5,
      branchCount: Math.floor(Math.random() * 20) + 10,
      cycleCount: Math.floor(Math.random() * 5),
      connectedComponents: 3
    };
  }

  assessConfidence(detectionData: any) {
    return {
      overall: detectionData.confidence,
      factors: [
        { name: '图像质量', score: 0.8 },
        { name: '检测算法', score: 0.9 },
        { name: '静脉清晰度', score: 0.7 }
      ]
    };
  }
}

export class ROIProcessor {
  extractROI(frame: any, roi: any) {
    return {
      x: Math.max(0, roi.x),
      y: Math.max(0, roi.y),
      width: Math.min(roi.width, frame.width - roi.x),
      height: Math.min(roi.height, frame.height - roi.y),
      data: Buffer.alloc(roi.width * roi.height * 4)
    };
  }

  adjustROI(roi: any, adjustment: any) {
    return {
      x: roi.x + (adjustment.dx || 0),
      y: roi.y + (adjustment.dy || 0),
      width: roi.width + (adjustment.dw || 0),
      height: roi.height + (adjustment.dh || 0)
    };
  }

  validateROI(roi: any, frame: any) {
    return roi.x >= 0 && roi.y >= 0 && 
           roi.x + roi.width <= frame.width &&
           roi.y + roi.height <= frame.height;
  }
}

export async function validateDetectionParams(params: any) {
  const errors: string[] = [];
  
  const validAlgorithms = ['adaptive_thresholding', 'sobel_edge', 'canny_edge', 'combined'];
  if (!validAlgorithms.includes(params.algorithm)) {
    errors.push('不支持的检测算法');
  }
  
  if (params.sensitivity < 0 || params.sensitivity > 1) {
    errors.push('敏感度必须在0-1之间');
  }
  
  if (params.roiSize.width <= 0 || params.roiSize.height <= 0) {
    errors.push('ROI尺寸必须大于0');
  }
  
  if (params.contrast < 0) {
    errors.push('对比度不能为负');
  }
  
  if (params.brightness < -255 || params.brightness > 255) {
    errors.push('亮度值超出范围');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function processVideoFrame(frame: any, options: any) {
  const veinDetector = new VeinDetector(options);
  const result = await veinDetector.detectVeins(frame);
  
  return {
    success: result.success,
    detectionData: result,
    confidence: result.confidence,
    veinPoints: result.veinPoints
  };
}

export async function extractVeinFeatures(frame: any) {
  return {
    veinDensity: Math.random() * 0.8 + 0.1,
    veinThickness: {
      average: Math.random() * 5 + 2,
      minimum: Math.random() * 2 + 1,
      maximum: Math.random() * 8 + 5
    },
    veinCurvature: {
      average: Math.random() * 0.3,
      variance: Math.random() * 0.1
    },
    contrastRatio: Math.random() * 0.5 + 0.3,
    textureFeatures: {
      entropy: Math.random() * 8 + 2,
      homogeneity: Math.random() * 0.5 + 0.3,
      energy: Math.random() * 0.3 + 0.1
    }
  };
}

function generateMockVeinPoints() {
  const points = [];
  for (let i = 0; i < 50; i++) {
    points.push({
      x: Math.random() * 640,
      y: Math.random() * 480,
      confidence: Math.random()
    });
  }
  return points;
}

function generateMockVeinSegments() {
  const segments = [];
  for (let i = 0; i < 10; i++) {
    segments.push({
      start: { x: Math.random() * 640, y: Math.random() * 480 },
      end: { x: Math.random() * 640, y: Math.random() * 480 },
      thickness: Math.random() * 5 + 1,
      confidence: Math.random()
    });
  }
  return segments;
}