// 系统集成测试
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createServer } from '../src/server';
import { setupDatabase, cleanupDatabase } from '../src/testUtils/database';
import { startServices, stopServices } from '../src/testUtils/services';

describe('系统集成测试', () => {
  let app: express.Application;
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    // 启动所有服务
    await startServices();
    
    // 启动测试服务器
    const serverInfo = await createServer();
    app = serverInfo.app;
    server = serverInfo.server;
    baseUrl = serverInfo.url;
    
    console.log(`测试服务器启动在: ${baseUrl}`);
  });

  afterAll(async () => {
    // 停止服务
    await stopServices();
    if (server) {
      await server.close();
    }
  });

  beforeEach(async () => {
    // 设置测试数据库
    await setupDatabase();
  });

  afterEach(async () => {
    // 清理测试数据库
    await cleanupDatabase();
  });

  describe('健康检查集成', () => {
    test('前端服务健康检查', async () => {
      const response = await request(app)
        .get('/health/frontend')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    test('后端服务健康检查', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('database', 'connected');
      expect(response.body).toHaveProperty('services');
    });

    test('视频服务健康检查', async () => {
      const response = await request(app)
        .get('/video/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('ffmpeg', 'available');
      expect(response.body).toHaveProperty('tempSpace', 'sufficient');
    });

    test('整体系统健康检查', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('frontend');
      expect(response.body.services).toHaveProperty('backend');
      expect(response.body.services).toHaveProperty('videoService');
    });
  });

  describe('API接口集成测试', () => {
    describe('视频上传API', () => {
      test('POST /api/upload - 正常上传', async () => {
        const videoFile = createTestVideoFile();
        
        const response = await request(app)
          .post('/api/upload')
          .attach('video', videoFile.buffer, videoFile.name)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('fileId');
        expect(response.body).toHaveProperty('filePath');
        expect(response.body).toHaveProperty('metadata');
      });

      test('POST /api/upload - 文件过大', async () => {
        const largeFile = createLargeTestVideoFile(150 * 1024 * 1024); // 150MB
        
        const response = await request(app)
          .post('/api/upload')
          .attach('video', largeFile.buffer, largeFile.name)
          .expect(413);

        expect(response.body).toHaveProperty('error', '文件大小超出限制');
      });

      test('POST /api/upload - 不支持的文件格式', async () => {
        const invalidFile = {
          buffer: Buffer.from('invalid video data'),
          name: 'test.txt'
        };
        
        const response = await request(app)
          .post('/api/upload')
          .attach('video', invalidFile.buffer, invalidFile.name)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      test('POST /api/upload - 断点续传支持', async () => {
        const videoFile = createTestVideoFile();
        
        const response = await request(app)
          .post('/api/upload')
          .set('Content-Range', 'bytes=0-1024')
          .attach('video', videoFile.buffer, videoFile.name)
          .expect(200);

        expect(response.body).toHaveProperty('uploadedBytes');
        expect(response.body.uploadedBytes).toBe(1025);
      });
    });

    describe('静脉检测API', () => {
      let uploadedFileId: string;

      beforeEach(async () => {
        // 先上传一个视频文件用于检测
        const videoFile = createTestVideoFile();
        const uploadResponse = await request(app)
          .post('/api/upload')
          .attach('video', videoFile.buffer, videoFile.name);
        
        uploadedFileId = uploadResponse.body.fileId;
      });

      test('POST /api/detect - 静脉检测', async () => {
        const detectionRequest = {
          fileId: uploadedFileId,
          algorithm: 'adaptive_thresholding',
          roi: {
            x: 100,
            y: 100,
            width: 200,
            height: 200
          },
          sensitivity: 0.8
        };

        const response = await request(app)
          .post('/api/detect')
          .send(detectionRequest)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('detectionId');
        expect(response.body).toHaveProperty('confidence');
        expect(response.body).toHaveProperty('results');
        expect(response.body.results).toHaveProperty('veinPoints');
        expect(response.body.results).toHaveProperty('segments');
      });

      test('POST /api/detect - 无效文件ID', async () => {
        const detectionRequest = {
          fileId: 'invalid_file_id',
          algorithm: 'adaptive_thresholding'
        };

        const response = await request(app)
          .post('/api/detect')
          .send(detectionRequest)
          .expect(404);

        expect(response.body).toHaveProperty('error', '文件未找到');
      });

      test('POST /api/detect - 无效算法参数', async () => {
        const detectionRequest = {
          fileId: uploadedFileId,
          algorithm: 'invalid_algorithm',
          sensitivity: 2.0 // 超出范围
        };

        const response = await request(app)
          .post('/api/detect')
          .send(detectionRequest)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      test('GET /api/detect/:id - 获取检测结果', async () => {
        // 先发起检测请求
        const detectionRequest = {
          fileId: uploadedFileId,
          algorithm: 'adaptive_thresholding'
        };

        const detectionResponse = await request(app)
          .post('/api/detect')
          .send(detectionRequest);
        
        const detectionId = detectionResponse.body.detectionId;

        // 获取检测结果
        const response = await request(app)
          .get(`/api/detect/${detectionId}`)
          .expect(200);

        expect(response.body).toHaveProperty('detectionId', detectionId);
        expect(response.body).toHaveProperty('status', 'completed');
        expect(response.body).toHaveProperty('results');
      });
    });

    describe('ROI交互API', () => {
      test('PUT /api/roi - 更新ROI', async () => {
        const roiUpdateRequest = {
          fileId: 'test_file_id',
          roi: {
            x: 150,
            y: 150,
            width: 180,
            height: 180
          }
        };

        const response = await request(app)
          .put('/api/roi')
          .send(roiUpdateRequest)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('roi');
        expect(response.body.roi).toEqual(roiUpdateRequest.roi);
      });

      test('POST /api/roi/adjust - ROI调整', async () => {
        const roiAdjustRequest = {
          fileId: 'test_file_id',
          currentRoi: {
            x: 100,
            y: 100,
            width: 200,
            height: 200
          },
          adjustment: {
            dx: 20,
            dy: -10,
            dw: 30,
            dh: -15
          }
        };

        const response = await request(app)
          .post('/api/roi/adjust')
          .send(roiAdjustRequest)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('newRoi');
        expect(response.body.newRoi.x).toBe(120);
        expect(response.body.newRoi.y).toBe(90);
        expect(response.body.newRoi.width).toBe(230);
        expect(response.body.newRoi.height).toBe(185);
      });
    });
  });

  describe('WebSocket集成测试', () => {
    test('WebSocket连接建立', (done) => {
      const ws = require('ws');
      const websocket = new ws.WebSocket(`${baseUrl.replace('http', 'ws')}/ws`);
      
      websocket.on('open', () => {
        expect(websocket.readyState).toBe(ws.WebSocket.OPEN);
        websocket.close();
        done();
      });

      websocket.on('error', (error: any) => {
        done(error);
      });
    });

    test('实时检测进度推送', (done) => {
      const ws = require('ws');
      const websocket = new ws.WebSocket(`${baseUrl.replace('http', 'ws')}/ws`);
      
      websocket.on('open', () => {
        // 发送检测请求
        websocket.send(JSON.stringify({
          type: 'start_detection',
          fileId: 'test_file_id',
          algorithm: 'adaptive_thresholding'
        }));
      });

      websocket.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'detection_progress') {
          expect(message).toHaveProperty('progress');
          expect(message).toHaveProperty('stage');
          
          if (message.progress === 100) {
            websocket.close();
            done();
          }
        }
      });

      websocket.on('error', (error: any) => {
        done(error);
      });
    });
  });

  describe('跨域处理集成', () => {
    test('CORS预检请求', async () => {
      const response = await request(app)
        .options('/api/detect')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    test('跨域POST请求', async () => {
      const response = await request(app)
        .post('/api/health')
        .set('Origin', 'http://localhost:3000')
        .send({})
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('性能集成测试', () => {
    test('并发上传处理', async () => {
      const promises = [];
      const concurrentUploads = 5;

      for (let i = 0; i < concurrentUploads; i++) {
        const videoFile = createTestVideoFile();
        const promise = request(app)
          .post('/api/upload')
          .attach('video', videoFile.buffer, videoFile.name);
        promises.push(promise);
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // 检查所有请求都成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // 并发处理时间应该合理
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(10000); // 10秒内完成

      console.log(`并发${concurrentUploads}个上传请求，耗时${processingTime}ms`);
    });

    test('连续检测请求', async () => {
      const detectionRequests = [];
      const requestCount = 10;

      for (let i = 0; i < requestCount; i++) {
        const request = {
          fileId: `test_file_${i}`,
          algorithm: 'adaptive_thresholding'
        };
        detectionRequests.push(request);
      }

      const startTime = Date.now();
      const responses = await Promise.all(
        detectionRequests.map(req => 
          request(app).post('/api/detect').send(req)
        )
      );
      const endTime = Date.now();

      // 检查响应
      responses.forEach(response => {
        if (response.status === 404) {
          // 预期的错误（文件不存在）
          expect(response.body).toHaveProperty('error');
        } else {
          expect(response.status).toBe(200);
        }
      });

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // 5秒内完成

      console.log(`连续${requestCount}个检测请求，耗时${processingTime}ms`);
    });
  });

  describe('错误处理集成', () => {
    test('服务不可用处理', async () => {
      // 模拟后端服务不可用
      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body).toHaveProperty('error', '服务不可用');
    });

    test('数据库连接失败处理', async () => {
      const response = await request(app)
        .post('/api/detect')
        .send({
          fileId: 'test_file',
          algorithm: 'adaptive_thresholding'
        })
        .expect(503);

      expect(response.body).toHaveProperty('error');
    });

    test('视频服务不可用处理', async () => {
      const response = await request(app)
        .post('/api/upload')
        .attach('video', Buffer.from('test'), 'test.mp4')
        .expect(503);

      expect(response.body).toHaveProperty('error');
    });
  });
});

// 辅助函数
function createTestVideoFile() {
  return {
    buffer: Buffer.alloc(1024 * 1024), // 1MB
    name: 'test_video.mp4',
    mimetype: 'video/mp4'
  };
}

function createLargeTestVideoFile(size: number) {
  return {
    buffer: Buffer.alloc(size),
    name: 'large_video.mp4',
    mimetype: 'video/mp4'
  };
}