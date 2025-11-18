// 测试环境设置文件
const { TextEncoder, TextDecoder } = require('util');

// 全局变量设置
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/vein_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.UPLOAD_PATH = '/tmp/test-uploads';
process.env.TEMP_PATH = '/tmp/test-temp';
process.env.CACHE_PATH = '/tmp/test-cache';

// 模拟console方法以减少测试输出噪音
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// 全局测试配置
global.TEST_CONFIG = {
  TIMEOUT: {
    SHORT: 5000,
    MEDIUM: 10000,
    LONG: 30000,
    VERY_LONG: 60000
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 100
  },
  METRICS: {
    THRESHOLDS: {
      CPU: 80,
      MEMORY: 85,
      DISK: 90,
      RESPONSE_TIME: 2000
    }
  }
};

// 清理函数
afterEach(() => {
  // 清理所有定时器
  jest.clearAllTimers();
  
  // 清理所有模拟
  jest.clearAllMocks();
  
  // 恢复console
  Object.keys(global.console).forEach(key => {
    if (typeof global.console[key] === 'function' && 
        typeof originalConsole[key] === 'function') {
      global.console[key].mockRestore();
    }
  });
});

// 全局测试工具函数
global.createMockVideoFrame = (width = 1920, height = 1080, options = {}) => {
  const frameSize = width * height * 4; // RGBA
  return {
    width,
    height,
    id: options.id || `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    data: Buffer.alloc(frameSize),
    timestamp: Date.now(),
    frameNumber: options.frameNumber || Math.floor(Math.random() * 1000),
    quality: options.quality || 'medium',
    contrast: options.contrast || 0.8,
    brightness: options.brightness || 0.5,
    metadata: {
      format: 'RGBA',
      size: frameSize,
      compression: 'none',
      ...options.metadata
    }
  };
};

global.createMockDetectionResult = (options = {}) => {
  const frame = global.createMockVideoFrame();
  const numPoints = options.numPoints || 50;
  const points = [];
  
  for (let i = 0; i < numPoints; i++) {
    points.push({
      x: Math.random() * frame.width,
      y: Math.random() * frame.height,
      confidence: Math.random(),
      strength: Math.random()
    });
  }
  
  return {
    success: options.success !== false,
    algorithm: options.algorithm || 'adaptive_thresholding',
    processingTime: options.processingTime || Math.random() * 100 + 20,
    confidence: options.confidence || Math.random() * 0.8 + 0.2,
    veinPoints: points,
    segments: generateMockSegments(points),
    metadata: {
      frameId: frame.id,
      timestamp: Date.now(),
      version: '1.0.0'
    },
    ...options
  };
};

function generateMockSegments(points) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 5) {
    if (i + 1 < points.length) {
      segments.push({
        start: points[i],
        end: points[i + 1],
        thickness: Math.random() * 5 + 1,
        confidence: Math.random(),
        curvature: Math.random()
      });
    }
  }
  return segments;
}

global.generateMockTimeSeries = (duration = 1000, interval = 100, baseValue = 0, variance = 10) => {
  const data = [];
  const numPoints = Math.floor(duration / interval);
  
  for (let i = 0; i < numPoints; i++) {
    data.push({
      timestamp: Date.now() + i * interval,
      value: baseValue + (Math.random() - 0.5) * variance * 2
    });
  }
  
  return data;
};

global.waitFor = (condition, timeout = 5000, interval = 100) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkCondition = () => {
      try {
        if (condition()) {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`条件检查超时 (${timeout}ms)`));
        } else {
          setTimeout(checkCondition, interval);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    checkCondition();
  });
};

global.waitForAsync = async (asyncCondition, timeout = 5000, interval = 100) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      if (await asyncCondition()) {
        return true;
      }
    } catch (error) {
      // 忽略错误继续尝试
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`异步条件检查超时 (${timeout}ms)`);
};

// 性能测试辅助函数
global.measurePerformance = async (fn, iterations = 1) => {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1000000); // 转换为毫秒
  }
  
  const average = times.reduce((sum, time) => sum + time, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return {
    average,
    min,
    max,
    times,
    iterations
  };
};

// 内存使用测量
global.measureMemory = (fn) => {
  const initialMemory = process.memoryUsage();
  
  fn();
  
  const finalMemory = process.memoryUsage();
  const usedMemory = finalMemory.heapUsed - initialMemory.heapUsed;
  const totalMemory = finalMemory.heapTotal - initialMemory.heapTotal;
  
  return {
    used: usedMemory,
    total: totalMemory,
    rss: finalMemory.rss - initialMemory.rss
  };
};

// 文件系统辅助函数
global.createTestFile = (filename, content = '', options = {}) => {
  const fs = require('fs');
  const path = require('path');
  const tempDir = options.tempDir || '/tmp/test-files';
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content);
  
  return {
    path: filePath,
    cleanup: () => {
      try {
        fs.unlinkSync(filePath);
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (error) {
        // 忽略清理错误
      }
    }
  };
};

global.createTestDirectory = (dirname, options = {}) => {
  const fs = require('fs');
  const path = require('path');
  const tempDir = options.tempDir || '/tmp/test-dirs';
  const dirPath = path.join(tempDir, dirname);
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  return {
    path: dirPath,
    cleanup: () => {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
      } catch (error) {
        // 忽略清理错误
      }
    }
  };
};

// 网络请求辅助函数
global.makeHttpRequest = (options) => {
  const http = require('http');
  const https = require('https');
  
  return new Promise((resolve, reject) => {
    const client = options.url.startsWith('https') ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (parseError) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
};

// 数据库辅助函数
global.setupTestDatabase = async () => {
  // 模拟数据库设置
  const mockDB = {
    connected: false,
    tables: new Set(),
    records: new Map()
  };
  
  mockDB.connect = async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    mockDB.connected = true;
  };
  
  mockDB.disconnect = async () => {
    mockDB.connected = false;
    mockDB.tables.clear();
    mockDB.records.clear();
  };
  
  mockDB.createTable = async (name) => {
    mockDB.tables.add(name);
  };
  
  mockDB.insert = async (table, record) => {
    if (!mockDB.records.has(table)) {
      mockDB.records.set(table, []);
    }
    mockDB.records.get(table).push(record);
  };
  
  return mockDB;
};

// 模拟第三方库
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn((...args) => args),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    printf: jest.fn((fn) => fn),
    colorize: jest.fn(() => ({})),
    simple: jest.fn(() => ({}))
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'daily-rotate-file'
  }));
});

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }))
}));

jest.mock('multer', () => {
  return jest.fn().mockImplementation(() => ({
    single: jest.fn(() => (req, res, next) => next()),
    array: jest.fn(() => (req, res, next) => next())
  }));
});

jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.alloc(1000)),
    metadata: jest.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg'
    })
  }));
});

// 自定义匹配器
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toHaveBeenCalledWithProperties(received, expected) {
    const calls = received.mock.calls;
    const hasMatchingCall = calls.some(call => {
      return Object.keys(expected).every(key => {
        return call[0] && call[0][key] === expected[key];
      });
    });
    
    if (hasMatchingCall) {
      return {
        message: () => `expected mock not to have been called with properties ${JSON.stringify(expected)}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected mock to have been called with properties ${JSON.stringify(expected)}`,
        pass: false,
      };
    }
  },
  
  toBeValidDetectionResult(received) {
    const pass = received.success !== undefined &&
                 received.confidence !== undefined &&
                 received.veinPoints !== undefined &&
                 Array.isArray(received.veinPoints);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid detection result`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid detection result`,
        pass: false,
      };
    }
  }
});

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

// 性能监控
if (global.performance && !global.performance.mark) {
  global.performance.mark = jest.fn();
  global.performance.measure = jest.fn();
}

// 输出测试开始信息
console.log('🧪 测试环境已初始化');
console.log(`📁 项目根目录: ${__dirname}`);
console.log(`🌍 Node.js版本: ${process.version}`);
console.log(`💻 操作系统: ${process.platform}`);

// 导出全局工具
module.exports = {
  TEST_CONFIG: global.TEST_CONFIG,
  createMockVideoFrame: global.createMockVideoFrame,
  createMockDetectionResult: global.createMockDetectionResult,
  generateMockTimeSeries: global.generateMockTimeSeries,
  waitFor: global.waitFor,
  waitForAsync: global.waitForAsync,
  measurePerformance: global.measurePerformance,
  measureMemory: global.measureMemory,
  createTestFile: global.createTestFile,
  createTestDirectory: global.createTestDirectory,
  makeHttpRequest: global.makeHttpRequest,
  setupTestDatabase: global.setupTestDatabase
};