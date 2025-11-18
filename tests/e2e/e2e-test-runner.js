// 端到端测试脚本
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');

class E2ETestRunner {
  constructor() {
    this.browser = null;
    this.page = null;
    this.services = [];
    this.testResults = [];
  }

  async setup() {
    console.log('🚀 启动端到端测试环境...');
    
    // 启动测试服务
    await this.startTestServices();
    
    // 启动浏览器
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // 设置页面超时
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(30000);
  }

  async teardown() {
    console.log('🧹 清理测试环境...');
    
    if (this.browser) {
      await this.browser.close();
    }
    
    // 停止测试服务
    await this.stopTestServices();
  }

  async startTestServices() {
    const services = [
      { name: 'frontend', command: 'npm', args: ['start'], port: 3000 },
      { name: 'backend', command: 'node', args: ['server.js'], port: 8000 },
      { name: 'video-service', command: 'node', args: ['video-server.js'], port: 8080 }
    ];

    for (const service of services) {
      try {
        const process = spawn(service.command, service.args, {
          cwd: path.join(__dirname, `../../${service.name}`),
          stdio: 'pipe'
        });

        this.services.push({ ...service, process });
        console.log(`✅ ${service.name} 服务启动中...`);

        // 等待服务启动
        await this.waitForService(service.port);
        console.log(`✅ ${service.name} 服务已就绪`);
      } catch (error) {
        console.error(`❌ ${service.name} 服务启动失败:`, error.message);
      }
    }
  }

  async stopTestServices() {
    for (const service of this.services) {
      if (service.process) {
        service.process.kill();
        console.log(`🛑 ${service.name} 服务已停止`);
      }
    }
  }

  async waitForService(port, maxAttempts = 30) {
    const http = require('http');
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${port}/health`, (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`状态码: ${res.statusCode}`));
            }
          });
          
          req.on('error', reject);
          req.setTimeout(1000);
        });
        return;
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw new Error(`服务在端口 ${port} 启动超时`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async runTest(testName, testFunction) {
    console.log(`🧪 运行测试: ${testName}`);
    
    try {
      const startTime = Date.now();
      await testFunction.call(this);
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        status: 'passed',
        duration,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ ${testName} - 通过 (${duration}ms)`);
    } catch (error) {
      this.testResults.push({
        name: testName,
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.error(`❌ ${testName} - 失败:`, error.message);
      throw error;
    }
  }

  async testVideoUploadFlow() {
    // 访问首页
    await this.page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2'
    });

    // 检查页面标题
    const title = await this.page.title();
    expect(title).toContain('静脉检测系统');

    // 上传视频文件
    const videoFilePath = path.join(__dirname, '../../user_input_files/11月17日(1)-1.mp4');
    
    const fileInput = await this.page.$('input[type="file"]');
    expect(fileInput).toBeTruthy();

    await this.page.evaluate((input, filePath) => {
      const dataTransfer = new DataTransfer();
      const file = new File([''], 'test-video.mp4', { type: 'video/mp4' });
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, fileInput, videoFilePath);

    // 等待上传进度
    await this.page.waitForSelector('.upload-progress', { timeout: 10000 });
    
    // 检查上传状态
    const uploadStatus = await this.page.$('.upload-status');
    expect(uploadStatus).toBeTruthy();

    // 等待上传完成
    await this.page.waitForFunction(
      () => document.querySelector('.upload-status')?.textContent?.includes('完成'),
      { timeout: 30000 }
    );
  }

  async testVeinDetectionFlow() {
    // 先上传视频
    await this.testVideoUploadFlow();

    // 点击开始检测按钮
    const detectButton = await this.page.$('.detect-button');
    expect(detectButton).toBeTruthy();

    await this.page.click('.detect-button');

    // 等待检测进度显示
    await this.page.waitForSelector('.detection-progress', { timeout: 10000 });

    // 检查检测阶段显示
    const progressText = await this.page.$eval('.detection-progress', el => el.textContent);
    expect(progressText).toContain('预处理');

    // 等待检测完成
    await this.page.waitForFunction(
      () => document.querySelector('.detection-results') !== null,
      { timeout: 60000 }
    );

    // 检查检测结果
    const results = await this.page.$('.detection-results');
    expect(results).toBeTruthy();

    // 检查置信度显示
    const confidence = await this.page.$eval('.confidence-score', el => el.textContent);
    expect(confidence).toMatch(/\d+%/);
  }

  async testROIInteraction() {
    // 进入检测页面
    await this.page.goto('http://localhost:3000/detection', {
      waitUntil: 'networkidle2'
    });

    // 等待ROI区域显示
    await this.page.waitForSelector('.roi-container', { timeout: 10000 });

    // 模拟ROI区域拖拽
    const roiContainer = await this.page.$('.roi-container');
    const box = await roiContainer.boundingBox();

    // 拖拽ROI区域
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30);
    await this.page.mouse.up();

    // 等待ROI更新
    await this.page.waitForTimeout(500);

    // 检查ROI坐标更新
    const roiData = await this.page.evaluate(() => {
      return window.roiData || {};
    });

    expect(roiData.x).toBeDefined();
    expect(roiData.y).toBeDefined();

    // 测试ROI大小调整
    const resizeHandle = await this.page.$('.roi-resize-handle');
    if (resizeHandle) {
      const handleBox = await resizeHandle.boundingBox();
      await this.page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await this.page.mouse.down();
      await this.page.mouse.move(handleBox.x + handleBox.width / 2 + 30, handleBox.y + handleBox.height / 2 + 30);
      await this.page.mouse.up();

      await this.page.waitForTimeout(500);
    }
  }

  async testErrorHandling() {
    // 测试无效文件上传
    await this.page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2'
    });

    const fileInput = await this.page.$('input[type="file"]');
    
    // 上传非视频文件
    await this.page.evaluate((input) => {
      const dataTransfer = new DataTransfer();
      const file = new File(['invalid content'], 'test.txt', { type: 'text/plain' });
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, fileInput);

    // 检查错误提示
    await this.page.waitForSelector('.error-message', { timeout: 5000 });
    
    const errorMessage = await this.page.$eval('.error-message', el => el.textContent);
    expect(errorMessage).toContain('不支持的文件格式');

    // 测试网络错误处理
    await this.page.setOfflineMode(true);
    
    await this.page.goto('http://localhost:3000/detection');
    
    // 检查离线提示
    await this.page.waitForSelector('.offline-indicator', { timeout: 5000 });
    
    await this.page.setOfflineMode(false);
  }

  async testResponsiveDesign() {
    // 测试不同屏幕尺寸
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 }
    ];

    for (const viewport of viewports) {
      await this.page.setViewport(viewport);
      
      await this.page.goto('http://localhost:3000', {
        waitUntil: 'networkidle2'
      });

      // 检查页面布局
      const mainContent = await this.page.$('.main-content');
      expect(mainContent).toBeTruthy();

      // 检查移动端菜单（如果是小屏幕）
      if (viewport.width < 768) {
        const mobileMenu = await this.page.$('.mobile-menu');
        expect(mobileMenu).toBeTruthy();
      }

      // 检查视频播放器响应式
      const videoPlayer = await this.page.$('.video-player');
      if (videoPlayer) {
        const playerBox = await videoPlayer.boundingBox();
        expect(playerBox.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  }

  async testAccessibility() {
    await this.page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2'
    });

    // 检查页面标题
    const title = await this.page.title();
    expect(title).toBeTruthy();

    // 检查主要 landmarks
    const main = await this.page.$('main');
    expect(main).toBeTruthy();

    const nav = await this.page.$('nav');
    expect(nav).toBeTruthy();

    // 检查alt属性
    const images = await this.page.$$eval('img', imgs => 
      imgs.map(img => img.alt !== undefined)
    );
    expect(images.every(hasAlt => hasAlt)).toBe(true);

    // 检查表单标签
    const inputs = await this.page.$$('input');
    for (const input of inputs) {
      const id = await input.evaluate(el => el.id);
      if (id) {
        const label = await this.page.$(`label[for="${id}"]`);
        expect(label).toBeTruthy();
      }
    }

    // 检查键盘导航
    await this.page.keyboard.press('Tab');
    let focusedElement = await this.page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();

    // 检查焦点可见性
    const focusedElementStyles = await this.page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return null;
      const styles = window.getComputedStyle(active);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth
      };
    });
    
    expect(focusedElementStyles.outlineWidth).not.toBe('0px');
  }

  async testPerformance() {
    await this.page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2'
    });

    // 测量页面加载性能
    const performanceMetrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime,
        firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime
      };
    });

    console.log('性能指标:', performanceMetrics);

    // 检查性能阈值
    expect(performanceMetrics.loadComplete).toBeLessThan(3000); // 3秒内加载完成
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2000); // 2秒内首次内容绘制

    // 测量交互性能
    const uploadButton = await this.page.$('.upload-button');
    if (uploadButton) {
      const interactionStart = Date.now();
      await uploadButton.click();
      const interactionEnd = Date.now();
      
      expect(interactionEnd - interactionStart).toBeLessThan(100); // 100ms内响应
    }
  }

  async generateReport() {
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;
    const successRate = ((passed / total) * 100).toFixed(2);

    const report = {
      summary: {
        total,
        passed,
        failed,
        successRate: `${successRate}%`
      },
      tests: this.testResults,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        browserVersion: await this.browser.version()
      }
    };

    // 保存报告
    const reportPath = path.join(__dirname, '../../test-results/e2e-report.json');
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 测试报告摘要:');
    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`成功率: ${successRate}%`);
    console.log(`详细报告保存在: ${reportPath}`);

    return report;
  }
}

// 主测试执行
async function runE2ETests() {
  const runner = new E2ETestRunner();
  
  try {
    await runner.setup();

    // 运行所有测试
    await runner.runTest('视频上传流程', runner.testVideoUploadFlow);
    await runner.runTest('静脉检测流程', runner.testVeinDetectionFlow);
    await runner.runTest('ROI交互', runner.testROIInteraction);
    await runner.runTest('错误处理', runner.testErrorHandling);
    await runner.runTest('响应式设计', runner.testResponsiveDesign);
    await runner.runTest('可访问性', runner.testAccessibility);
    await runner.runTest('性能测试', runner.testPerformance);

    // 生成报告
    await runner.generateReport();

  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  } finally {
    await runner.teardown();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runE2ETests();
}

module.exports = { E2ETestRunner, runE2ETests };