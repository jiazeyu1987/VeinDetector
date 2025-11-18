// 视频上传功能测试用例
import { describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { createVideoUploadHandler, validateVideoFile, processVideoUpload } from '../src/videoUpload';
import fs from 'fs';
import path from 'path';

describe('视频上传功能测试', () => {
  const testVideoPath = path.join(__dirname, '../../user_input_files/11月17日(1)-1.mp4');
  const tempUploadPath = path.join(__dirname, '../temp');

  beforeAll(() => {
    // 创建临时上传目录
    if (!fs.existsSync(tempUploadPath)) {
      fs.mkdirSync(tempUploadPath, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理临时文件
    const files = fs.readdirSync(tempUploadPath);
    files.forEach(file => {
      fs.unlinkSync(path.join(tempUploadPath, file));
    });
  });

  test('视频文件格式验证 - 支持的格式', async () => {
    const supportedFormats = [
      'video/mp4',
      'video/avi', 
      'video/mov',
      'video/quicktime'
    ];

    for (const format of supportedFormats) {
      const mockFile = {
        mimetype: format,
        originalname: 'test.mp4',
        size: 1024 * 1024 // 1MB
      };
      
      const result = await validateVideoFile(mockFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  test('视频文件格式验证 - 不支持的格式', async () => {
    const unsupportedFormats = [
      'image/jpeg',
      'application/pdf',
      'text/plain'
    ];

    for (const format of unsupportedFormats) {
      const mockFile = {
        mimetype: format,
        originalname: 'test.jpg',
        size: 1024 * 1024
      };
      
      const result = await validateVideoFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('不支持的文件格式');
    }
  });

  test('视频文件大小验证 - 超大文件', async () => {
    const mockFile = {
      mimetype: 'video/mp4',
      originalname: 'test.mp4',
      size: 200 * 1024 * 1024 // 200MB
    };
    
    const result = await validateVideoFile(mockFile);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('文件大小超出限制（100MB）');
  });

  test('视频文件大小验证 - 空文件', async () => {
    const mockFile = {
      mimetype: 'video/mp4',
      originalname: 'test.mp4',
      size: 0
    };
    
    const result = await validateVideoFile(mockFile);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('文件不能为空');
  });

  test('视频上传处理 - 正常文件', async () => {
    // 模拟上传文件
    const mockFile = {
      path: testVideoPath,
      originalname: '11月17日(1)-1.mp4',
      mimetype: 'video/mp4',
      size: fs.statSync(testVideoPath).size
    };

    const uploadHandler = createVideoUploadHandler({
      uploadPath: tempUploadPath,
      maxFileSize: 100 * 1024 * 1024
    });

    const result = await uploadHandler(mockFile);
    
    expect(result.success).toBe(true);
    expect(result.fileId).toBeDefined();
    expect(result.filePath).toContain(tempUploadPath);
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  test('视频上传处理 - 断点续传支持', async () => {
    const mockFile = {
      path: testVideoPath,
      originalname: 'test.mp4',
      mimetype: 'video/mp4',
      size: fs.statSync(testVideoPath).size,
      headers: {
        'range': 'bytes=0-1024' // 模拟断点续传
      }
    };

    const uploadHandler = createVideoUploadHandler({
      uploadPath: tempUploadPath,
      supportsRange: true
    });

    const result = await uploadHandler(mockFile);
    
    expect(result.success).toBe(true);
    expect(result.rangeSupported).toBe(true);
    expect(result.uploadedBytes).toBe(1025); // bytes=0-1024 = 1025字节
  });

  test('视频元数据提取', async () => {
    if (!fs.existsSync(testVideoPath)) {
      console.log('测试视频文件不存在，跳过元数据测试');
      return;
    }

    const mockFile = {
      path: testVideoPath,
      originalname: '11月17日(1)-1.mp4',
      mimetype: 'video/mp4'
    };

    const result = await processVideoUpload(mockFile);
    
    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.duration).toBeDefined();
    expect(result.metadata.resolution).toBeDefined();
    expect(result.metadata.format).toBe('mp4');
  });

  test('视频上传错误处理 - 文件损坏', async () => {
    const mockFile = {
      path: '/dev/null', // 模拟损坏的文件
      originalname: 'corrupted.mp4',
      mimetype: 'video/mp4',
      size: 1024
    };

    const uploadHandler = createVideoUploadHandler({
      uploadPath: tempUploadPath
    });

    const result = await uploadHandler(mockFile);
    
    expect(result.success).toBe(false);
    expect(result.errors).toContain('文件损坏或格式错误');
  });

  test('并发上传处理', async () => {
    const uploadHandler = createVideoUploadHandler({
      uploadPath: tempUploadPath,
      maxConcurrent: 3
    });

    const uploadPromises = [];
    for (let i = 0; i < 5; i++) {
      const mockFile = {
        path: testVideoPath,
        originalname: `test${i}.mp4`,
        mimetype: 'video/mp4',
        size: fs.statSync(testVideoPath).size
      };
      uploadPromises.push(uploadHandler(mockFile));
    }

    const results = await Promise.all(uploadPromises);
    
    // 应该有3个成功，2个失败（超出并发限制）
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    expect(successCount).toBeLessThanOrEqual(3);
    expect(failCount).toBeGreaterThanOrEqual(2);
  });

  test('上传进度跟踪', async () => {
    const progressEvents: any[] = [];
    
    const mockFile = {
      path: testVideoPath,
      originalname: 'test.mp4',
      mimetype: 'video/mp4'
    };

    const uploadHandler = createVideoUploadHandler({
      uploadPath: tempUploadPath,
      onProgress: (progress) => {
        progressEvents.push(progress);
      }
    });

    const result = await uploadHandler(mockFile);
    
    expect(result.success).toBe(true);
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[0].percentage).toBeGreaterThanOrEqual(0);
    expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
  });
});

// 辅助函数实现
export function createVideoUploadHandler(options: any) {
  return async (file: any) => {
    try {
      // 文件验证
      const validation = await validateVideoFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // 模拟上传处理
      const fileId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const filePath = path.join(options.uploadPath, fileId + '.mp4');

      // 模拟进度回调
      if (options.onProgress) {
        for (let i = 0; i <= 100; i += 10) {
          options.onProgress({
            percentage: i,
            bytesUploaded: (file.size * i) / 100,
            bytesTotal: file.size
          });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      return {
        success: true,
        fileId,
        filePath,
        rangeSupported: options.supportsRange || false,
        uploadedBytes: file.size,
        metadata: {
          duration: 120, // 模拟2分钟视频
          resolution: '1920x1080',
          format: 'mp4',
          bitrate: '5000kbps',
          fps: 30
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [error.message]
      };
    }
  };
}

export async function validateVideoFile(file: any) {
  const errors: string[] = [];
  
  // 格式验证
  const allowedTypes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/quicktime'
  ];
  
  if (!allowedTypes.includes(file.mimetype)) {
    errors.push('不支持的文件格式');
  }
  
  // 大小验证
  if (file.size === 0) {
    errors.push('文件不能为空');
  }
  
  if (file.size > 100 * 1024 * 1024) { // 100MB
    errors.push('文件大小超出限制（100MB）');
  }
  
  // 文件名验证
  if (!file.originalname || !file.originalname.match(/\.(mp4|avi|mov|qt)$/i)) {
    errors.push('文件扩展名不正确');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function processVideoUpload(file: any) {
  const uploadResult = await createVideoUploadHandler({
    uploadPath: '/tmp'
  })(file);
  
  return uploadResult;
}