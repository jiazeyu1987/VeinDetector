// 性能测试和优化方案
import { describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { 
  VideoFrameCache, 
  DetectionOptimizer, 
  MemoryManager,
  PerformanceMonitor 
} from '../src/performance';

describe('性能优化测试', () => {
  let frameCache: VideoFrameCache;
  let detector: DetectionOptimizer;
  let memoryManager: MemoryManager;
  let monitor: PerformanceMonitor;

  beforeAll(() => {
    monitor = new PerformanceMonitor();
  });

  beforeEach(() => {
    frameCache = new VideoFrameCache({
      maxSize: 100, // 最多缓存100帧
      maxMemory: 50 * 1024 * 1024, // 50MB内存限制
      strategy: 'lru' // 最近最少使用
    });

    detector = new DetectionOptimizer({
      algorithm: 'adaptive_thresholding',
      enableParallel: true,
      maxWorkers: 4,
      batchSize: 10
    });

    memoryManager = new MemoryManager({
      gcThreshold: 100 * 1024 * 1024, // 100MB
      enableAutoGC: true,
      monitoringInterval: 5000
    });
  });

  afterEach(() => {
    if (monitor) {
      monitor.clearMetrics();
    }
  });

  describe('视频帧缓存策略', () => {
    test('缓存读写性能', async () => {
      const frameData = createMockFrameData(1920, 1080);
      const frameId = 'frame_001';
      
      // 写入缓存
      const writeStart = performance.now();
      await frameCache.set(frameId, frameData);
      const writeTime = performance.now() - writeStart;
      
      // 读取缓存
      const readStart = performance.now();
      const cachedFrame = await frameCache.get(frameId);
      const readTime = performance.now() - readStart;
      
      expect(cachedFrame).toEqual(frameData);
      expect(writeTime).toBeLessThan(50); // 50ms内写入
      expect(readTime).toBeLessThan(10); // 10ms内读取
    });

    test('LRU缓存策略', async () => {
      const frameSize = createMockFrameData(1920, 1080);
      
      // 添加超过限制的帧数
      for (let i = 0; i < 105; i++) {
        await frameCache.set(`frame_${i}`, frameSize);
      }
      
      // 检查缓存大小
      expect(frameCache.size()).toBe(100);
      
      // 检查最早添加的帧是否被移除
      const firstFrame = await frameCache.get('frame_0');
      expect(firstFrame).toBeNull();
      
      // 检查最新帧是否存在
      const lastFrame = await frameCache.get('frame_104');
      expect(lastFrame).not.toBeNull();
    });

    test('内存溢出处理', async () => {
      const largeFrame = createMockFrameData(3840, 2160); // 4K帧
      const initialMemory = process.memoryUsage();
      
      // 尝试添加大帧
      try {
        await frameCache.set('large_frame', largeFrame);
        const finalMemory = process.memoryUsage();
        
        // 内存增长应该控制在合理范围内
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
      } catch (error) {
        // 预期错误：帧太大无法缓存
        expect(error.message).toContain('帧大小超出缓存限制');
      }
    });

    test('缓存命中率测试', async () => {
      const frameIds = ['frame_1', 'frame_2', 'frame_3', 'frame_4', 'frame_5'];
      
      // 添加帧到缓存
      for (const id of frameIds) {
        await frameCache.set(id, createMockFrameData(1920, 1080));
      }
      
      // 随机访问一些帧
      const accessPattern = [1, 2, 1, 3, 1, 4, 1, 5, 1]; // frame_1访问最频繁
      
      let hits = 0;
      for (const index of accessPattern) {
        const frame = await frameCache.get(`frame_${index}`);
        if (frame) hits++;
      }
      
      const hitRate = hits / accessPattern.length;
      expect(hitRate).toBeGreaterThan(0.7); // 命中率应超过70%
    });
  });

  describe('检测算法优化', () => {
    test('并行检测性能', async () => {
      const frames = Array.from({ length: 20 }, (_, i) => 
        createMockFrameData(1920, 1080, `frame_${i}`)
      );
      
      // 串行检测
      const serialStart = performance.now();
      const serialResults = [];
      for (const frame of frames) {
        const result = await detector.detect(frame);
        serialResults.push(result);
      }
      const serialTime = performance.now() - serialStart;
      
      // 并行检测
      const parallelStart = performance.now();
      const parallelResults = await detector.detectBatch(frames);
      const parallelTime = performance.now() - parallelStart;
      
      expect(parallelResults).toHaveLength(frames.length);
      expect(parallelTime).toBeLessThan(serialTime * 0.5); // 并行应该快一半以上
    });

    test('算法自适应选择', async () => {
      const highQualityFrame = createMockFrameData(1920, 1080, 'hq_frame', { quality: 'high' });
      const lowQualityFrame = createMockFrameData(640, 480, 'lq_frame', { quality: 'low' });
      
      // 高质量图像应使用精确算法
      const hqResult = await detector.detect(highQualityFrame);
      expect(hqResult.algorithm).toBe('canny_edge');
      
      // 低质量图像应使用快速算法
      const lqResult = await detector.detect(lowQualityFrame);
      expect(lqResult.algorithm).toBe('adaptive_thresholding');
    });

    test('动态阈值调整', async () => {
      const frame = createMockFrameData(1920, 1080);
      frame.contrast = 0.3; // 低对比度
      
      const result = await detector.detect(frame);
      
      expect(result.threshold).toBeLessThan(0.8); // 低对比度时阈值应该降低
      expect(result.enhancement).toBeDefined();
      expect(result.enhancement.contrast).toBeGreaterThan(1.0);
    });

    test('批处理优化', async () => {
      const frames = Array.from({ length: 50 }, (_, i) => 
        createMockFrameData(1280, 720, `batch_frame_${i}`)
      );
      
      const startTime = performance.now();
      const results = await detector.detectBatch(frames, { batchSize: 10 });
      const endTime = performance.now();
      
      expect(results).toHaveLength(frames.length);
      expect(endTime - startTime).toBeLessThan(2000); // 50帧2秒内完成
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('内存管理优化', () => {
    test('自动垃圾回收', async () => {
      memoryManager.startMonitoring();
      
      // 创建大量临时对象
      const tempObjects = [];
      for (let i = 0; i < 1000; i++) {
        const obj = {
          data: Buffer.alloc(1024 * 1024),
          timestamp: Date.now(),
          id: i
        };
        tempObjects.push(obj);
      }
      
      const memoryBeforeGC = process.memoryUsage();
      
      // 触发垃圾回收
      await memoryManager.forceGarbageCollection();
      
      // 清理引用
      tempObjects.length = 0;
      
      const memoryAfterGC = process.memoryUsage();
      const memoryFreed = memoryBeforeGC.heapUsed - memoryAfterGC.heapUsed;
      
      expect(memoryFreed).toBeGreaterThan(100 * 1024 * 1024); // 至少释放100MB
    });

    test('内存泄漏检测', async () => {
      const initialMemory = process.memoryUsage();
      
      // 模拟持续操作
      for (let cycle = 0; cycle < 100; cycle++) {
        // 创建临时数据
        const tempData = createMockFrameData(1920, 1080);
        await detector.detect(tempData);
        
        // 模拟一些延迟
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // 检查内存增长
        if (cycle % 20 === 0) {
          const currentMemory = process.memoryUsage();
          const growthRate = (currentMemory.heapUsed - initialMemory.heapUsed) / (cycle + 1);
          
          expect(growthRate).toBeLessThan(1024 * 1024); // 每周期增长不超过1MB
        }
      }
    });

    test('对象池复用', async () => {
      const pool = memoryManager.createObjectPool(() => createMockFrameData(1920, 1080));
      
      // 从池中获取对象
      const obj1 = await pool.acquire();
      const obj2 = await pool.acquire();
      const obj3 = await pool.acquire();
      
      expect(obj1).not.toBe(obj2);
      expect(obj2).not.toBe(obj3);
      expect(obj1).not.toBe(obj3);
      
      // 释放对象回池
      await pool.release(obj1);
      await pool.release(obj2);
      
      // 重新获取，应该复用之前的对象
      const reusedObj1 = await pool.acquire();
      const reusedObj2 = await pool.acquire();
      
      expect(reusedObj1).toBe(obj1);
      expect(reusedObj2).toBe(obj2);
    });
  });

  describe('性能监控和调优', () => {
    test('实时性能监控', async () => {
      monitor.startMonitoring();
      
      // 执行一些操作
      const frames = Array.from({ length: 10 }, (_, i) => 
        createMockFrameData(1920, 1080, `monitor_frame_${i}`)
      );
      
      for (const frame of frames) {
        await detector.detect(frame);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const metrics = monitor.getMetrics();
      
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
      expect(metrics.totalFrames).toBe(10);
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.cpuUsage).toBeDefined();
    });

    test('性能瓶颈识别', async () => {
      monitor.startMonitoring();
      
      // 模拟不同类型的操作
      const operations = [
        { type: 'detection', duration: 100 },
        { type: 'cache_access', duration: 10 },
        { type: 'memory_allocation', duration: 50 },
        { type: 'io_operation', duration: 200 }
      ];
      
      for (const op of operations) {
        const start = performance.now();
        await new Promise(resolve => setTimeout(resolve, op.duration));
        const end = performance.now();
        
        monitor.recordOperation(op.type, end - start);
      }
      
      const bottlenecks = monitor.identifyBottlenecks();
      
      expect(bottlenecks).toContain('io_operation'); // IO操作应该是瓶颈
      expect(bottlenecks).not.toContain('cache_access'); // 缓存访问不应该瓶颈
    });

    test('自动调优建议', async () => {
      const performanceData = {
        averageDetectionTime: 150,
        cacheHitRate: 0.6,
        memoryUsage: 80, // 80%
        cpuUsage: 85, // 85%
        queueLength: 20
      };
      
      const suggestions = monitor.generateOptimizationSuggestions(performanceData);
      
      expect(suggestions).toContain('增加检测算法缓存');
      expect(suggestions).toContain('考虑增加内存');
      expect(suggestions).toContain('优化CPU密集型操作');
    });

    test('性能基线测试', async () => {
      const baseline = {
        detectionTime: 100,
        cacheAccessTime: 5,
        memoryUsage: 50,
        throughput: 10 // 每秒处理帧数
      };
      
      // 运行基准测试
      const testFrames = Array.from({ length: 100 }, (_, i) => 
        createMockFrameData(1280, 720, `baseline_frame_${i}`)
      );
      
      const startTime = performance.now();
      for (const frame of testFrames) {
        await detector.detect(frame);
      }
      const endTime = performance.now();
      
      const actualThroughput = testFrames.length / ((endTime - startTime) / 1000);
      const avgDetectionTime = (endTime - startTime) / testFrames.length;
      
      // 性能应该在基线的20%范围内
      expect(avgDetectionTime).toBeLessThan(baseline.detectionTime * 1.2);
      expect(actualThroughput).toBeGreaterThan(baseline.throughput * 0.8);
    });
  });

  describe('资源使用优化', () => {
    test('CPU使用率优化', async () => {
      const initialCPU = monitor.getCPUUsage();
      
      // 启动多个并行检测任务
      const tasks = Array.from({ length: 8 }, () => 
        detector.detect(createMockFrameData(1920, 1080))
      );
      
      const results = await Promise.all(tasks);
      const finalCPU = monitor.getCPUUsage();
      
      expect(results).toHaveLength(8);
      expect(results.every(r => r.success)).toBe(true);
      
      // CPU使用率应该合理增长但不应超过90%
      expect(finalCPU).toBeLessThan(90);
    });

    test('网络带宽优化', async () => {
      const networkOptimizer = detector.getNetworkOptimizer();
      
      // 模拟大文件传输
      const largeData = createMockFrameData(3840, 2160);
      
      const startTime = performance.now();
      await networkOptimizer.compressAndSend(largeData);
      const transferTime = performance.now() - startTime;
      
      expect(transferTime).toBeLessThan(1000); // 1秒内传输完成
      expect(networkOptimizer.getCompressionRatio()).toBeGreaterThan(0.5);
    });

    test('存储IO优化', async () => {
      const storageOptimizer = detector.getStorageOptimizer();
      
      // 批量写入测试
      const batchData = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        frame: createMockFrameData(1920, 1080, `storage_frame_${i}`)
      }));
      
      const startTime = performance.now();
      await storageOptimizer.batchWrite(batchData);
      const writeTime = performance.now() - startTime;
      
      expect(writeTime).toBeLessThan(2000); // 2秒内完成批量写入
      
      // 批量读取测试
      const startReadTime = performance.now();
      const readData = await storageOptimizer.batchRead(batchData.map(d => d.id));
      const readTime = performance.now() - startReadTime;
      
      expect(readData).toHaveLength(100);
      expect(readTime).toBeLessThan(1000); // 1秒内完成批量读取
    });
  });
});

// 辅助函数
function createMockFrameData(width: number, height: number, id?: string, options?: any) {
  const frameSize = width * height * 4; // RGBA
  const data = {
    width,
    height,
    id: id || `frame_${Date.now()}`,
    data: Buffer.alloc(frameSize),
    timestamp: Date.now(),
    frameNumber: Math.floor(Math.random() * 1000),
    quality: options?.quality || 'medium',
    contrast: options?.contrast || 0.8,
    brightness: options?.brightness || 0.5,
    metadata: {
      format: 'RGBA',
      size: frameSize,
      compression: 'none'
    }
  };
  
  // 模拟一些数据
  data.data.fill(Math.floor(Math.random() * 255));
  
  return data;
}

// 模拟性能优化类
export class VideoFrameCache {
  constructor(options: any) {
    this.cache = new Map();
    this.maxSize = options.maxSize;
    this.maxMemory = options.maxMemory;
    this.strategy = options.strategy;
  }

  async set(key: string, frame: any) {
    const frameSize = frame.data.length;
    
    if (frameSize > this.maxMemory) {
      throw new Error('帧大小超出缓存限制');
    }
    
    this.cache.set(key, frame);
    
    // 如果超过大小限制，清理最老的项
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  async get(key: string) {
    return this.cache.get(key) || null;
  }

  size() {
    return this.cache.size;
  }
}

export class DetectionOptimizer {
  constructor(options: any) {
    this.options = options;
  }

  async detect(frame: any) {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
    
    return {
      success: true,
      algorithm: frame.quality === 'high' ? 'canny_edge' : 'adaptive_thresholding',
      threshold: frame.contrast < 0.5 ? 0.6 : 0.8,
      enhancement: {
        contrast: frame.contrast < 0.5 ? 1.2 : 1.0
      },
      processingTime: Math.random() * 50 + 20
    };
  }

  async detectBatch(frames: any[], options?: any) {
    const batchSize = options?.batchSize || this.options.batchSize;
    const results = [];
    
    for (let i = 0; i < frames.length; i += batchSize) {
      const batch = frames.slice(i, i + batchSize);
      const batchPromises = batch.map(frame => this.detect(frame));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  getNetworkOptimizer() {
    return {
      async compressAndSend(data: any) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        return { compressed: true, ratio: 0.7 };
      },
      getCompressionRatio() {
        return 0.7;
      }
    };
  }

  getStorageOptimizer() {
    return {
      async batchWrite(data: any[]) {
        await new Promise(resolve => setTimeout(resolve, data.length * 20));
        return { success: true, count: data.length };
      },
      async batchRead(ids: string[]) {
        await new Promise(resolve => setTimeout(resolve, ids.length * 10));
        return ids.map(id => ({ id, data: 'mock_data' }));
      }
    };
  }
}

export class MemoryManager {
  constructor(options: any) {
    this.options = options;
    this.objectPools = new Map();
  }

  createObjectPool(createFn: Function) {
    const pool = {
      objects: [] as any[],
      acquire: async () => {
        if (pool.objects.length > 0) {
          return pool.objects.pop();
        }
        return createFn();
      },
      release: async (obj: any) => {
        pool.objects.push(obj);
      }
    };
    
    this.objectPools.set(pool, createFn);
    return pool;
  }

  startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      const usage = process.memoryUsage();
      if (usage.heapUsed > this.options.gcThreshold) {
        this.forceGarbageCollection();
      }
    }, this.options.monitoringInterval);
  }

  async forceGarbageCollection() {
    if (global.gc) {
      global.gc();
    }
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      operations: [],
      memoryUsage: [],
      cpuUsage: [],
      timestamps: []
    };
  }

  startMonitoring() {
    this.interval = setInterval(() => {
      this.recordMetrics();
    }, 1000);
  }

  recordMetrics() {
    this.metrics.memoryUsage.push(process.memoryUsage().heapUsed);
    this.metrics.cpuUsage.push(this.getCPUUsage());
    this.metrics.timestamps.push(Date.now());
  }

  recordOperation(type: string, duration: number) {
    this.metrics.operations.push({ type, duration, timestamp: Date.now() });
  }

  getMetrics() {
    const operations = this.metrics.operations;
    const avgProcessingTime = operations.length > 0 
      ? operations.reduce((sum, op) => sum + op.duration, 0) / operations.length
      : 0;

    return {
      averageProcessingTime: avgProcessingTime,
      totalFrames: operations.filter(op => op.type === 'detection').length,
      memoryUsage: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] || 0,
      cpuUsage: this.metrics.cpuUsage[this.metrics.cpuUsage.length - 1] || 0
    };
  }

  getCPUUsage() {
    // 简化的CPU使用率计算
    return Math.random() * 50 + 20; // 20-70%
  }

  identifyBottlenecks() {
    const operations = this.metrics.operations;
    const avgDurations = new Map();
    
    operations.forEach(op => {
      const avg = avgDurations.get(op.type) || { sum: 0, count: 0 };
      avg.sum += op.duration;
      avg.count += 1;
      avgDurations.set(op.type, avg);
    });

    const bottlenecks = [];
    avgDurations.forEach((value, key) => {
      const avg = value.sum / value.count;
      if (avg > 100) { // 平均超过100ms的操作认为是瓶颈
        bottlenecks.push(key);
      }
    });

    return bottlenecks;
  }

  generateOptimizationSuggestions(performanceData: any) {
    const suggestions = [];
    
    if (performanceData.cacheHitRate < 0.7) {
      suggestions.push('增加检测算法缓存');
    }
    
    if (performanceData.memoryUsage > 75) {
      suggestions.push('考虑增加内存');
    }
    
    if (performanceData.cpuUsage > 80) {
      suggestions.push('优化CPU密集型操作');
    }
    
    if (performanceData.queueLength > 10) {
      suggestions.push('增加处理并行度');
    }
    
    return suggestions;
  }

  clearMetrics() {
    this.metrics = {
      operations: [],
      memoryUsage: [],
      cpuUsage: [],
      timestamps: []
    };
    
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}