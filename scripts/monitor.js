// 系统监控和健康检查系统
import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

class SystemMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      checkInterval: options.checkInterval || 30000, // 30秒
      timeout: options.timeout || 5000, // 5秒超时
      maxRetries: options.maxRetries || 3,
      alertThresholds: {
        cpu: options.cpuThreshold || 80,
        memory: options.memoryThreshold || 85,
        disk: options.diskThreshold || 90,
        responseTime: options.responseTimeThreshold || 2000
      },
      healthCheckEndpoints: options.healthCheckEndpoints || [
        { name: 'frontend', url: 'http://localhost:3000/health', method: 'GET' },
        { name: 'backend', url: 'http://localhost:8000/health', method: 'GET' },
        { name: 'video-service', url: 'http://localhost:8080/health', method: 'GET' },
        { name: 'database', url: 'http://localhost:5432/health', method: 'GET' }
      ],
      ...options
    };
    
    this.metrics = {
      services: new Map(),
      system: {
        cpu: [],
        memory: [],
        disk: [],
        network: [],
        timestamp: []
      },
      application: {
        requestCount: [],
        responseTime: [],
        errorRate: [],
        activeConnections: [],
        timestamp: []
      }
    };
    
    this.alerts = [];
    this.monitoring = false;
    this.checksInProgress = new Set();
  }

  // 开始监控
  start() {
    if (this.monitoring) {
      console.log('监控已在运行中');
      return;
    }
    
    this.monitoring = true;
    console.log('🟢 系统监控已启动');
    
    // 启动各项监控检查
    this.startHealthChecks();
    this.startSystemMetrics();
    this.startApplicationMetrics();
    this.startAlertProcessor();
  }

  // 停止监控
  stop() {
    this.monitoring = false;
    clearInterval(this.healthCheckInterval);
    clearInterval(this.systemMetricsInterval);
    clearInterval(this.applicationMetricsInterval);
    clearInterval(this.alertProcessorInterval);
    
    console.log('🔴 系统监控已停止');
  }

  // 启动健康检查
  startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkInterval);
    
    // 立即执行一次
    this.performHealthChecks();
  }

  // 执行健康检查
  async performHealthChecks() {
    for (const endpoint of this.config.healthCheckEndpoints) {
      if (this.checksInProgress.has(endpoint.name)) {
        continue; // 跳过正在进行的检查
      }
      
      this.checksInProgress.add(endpoint.name);
      
      try {
        const result = await this.checkEndpoint(endpoint);
        this.recordHealthCheck(endpoint.name, result);
        
        // 如果检查失败，触发告警
        if (!result.healthy) {
          this.handleUnhealthyService(endpoint.name, result);
        }
        
      } catch (error) {
        this.recordHealthCheck(endpoint.name, {
          healthy: false,
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        this.handleUnhealthyService(endpoint.name, { error: error.message });
        
      } finally {
        this.checksInProgress.delete(endpoint.name);
      }
    }
  }

  // 检查端点
  async checkEndpoint(endpoint) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const client = endpoint.url.startsWith('https') ? https : http;
      
      const request = client.get(endpoint.url, { timeout: this.config.timeout }, (response) => {
        const responseTime = Date.now() - startTime;
        
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({
              healthy: response.statusCode === 200,
              statusCode: response.statusCode,
              responseTime,
              data: parsed,
              timestamp: new Date().toISOString()
            });
          } catch (parseError) {
            resolve({
              healthy: response.statusCode === 200,
              statusCode: response.statusCode,
              responseTime,
              data: data,
              timestamp: new Date().toISOString()
            });
          }
        });
      });
      
      request.on('error', (error) => {
        resolve({
          healthy: false,
          status: 'error',
          error: error.message,
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      });
      
      request.on('timeout', () => {
        request.destroy();
        resolve({
          healthy: false,
          status: 'timeout',
          error: 'Request timeout',
          responseTime: this.config.timeout,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  // 记录健康检查结果
  recordHealthCheck(serviceName, result) {
    const service = this.metrics.services.get(serviceName) || {
      name: serviceName,
      status: 'unknown',
      checks: [],
      uptime: 0,
      lastCheck: null,
      consecutiveFailures: 0
    };
    
    service.lastCheck = result;
    service.status = result.healthy ? 'healthy' : 'unhealthy';
    service.checks.push(result);
    
    // 保持最近100次检查记录
    if (service.checks.length > 100) {
      service.checks = service.checks.slice(-100);
    }
    
    // 更新连续失败计数
    if (result.healthy) {
      service.consecutiveFailures = 0;
      service.uptime += this.config.checkInterval;
    } else {
      service.consecutiveFailures += 1;
    }
    
    this.metrics.services.set(serviceName, service);
    
    // 发出事件
    this.emit('healthCheck', { serviceName, result });
  }

  // 处理不健康服务
  handleUnhealthyService(serviceName, result) {
    const service = this.metrics.services.get(serviceName);
    if (!service) return;
    
    // 创建告警
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'service_unhealthy',
      severity: service.consecutiveFailures >= 3 ? 'critical' : 'warning',
      service: serviceName,
      message: `${serviceName} 服务不健康`,
      details: result,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
    this.emit('alert', alert);
  }

  // 启动系统指标监控
  startSystemMetrics() {
    this.systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 10000); // 每10秒收集一次
    
    this.collectSystemMetrics();
  }

  // 收集系统指标
  collectSystemMetrics() {
    const timestamp = Date.now();
    
    // CPU使用率
    const cpuUsage = this.getCPUUsage();
    this.metrics.system.cpu.push({ timestamp, value: cpuUsage });
    
    // 内存使用率
    const memoryUsage = this.getMemoryUsage();
    this.metrics.system.memory.push({ timestamp, value: memoryUsage });
    
    // 磁盘使用率
    this.getDiskUsage().then(diskUsage => {
      this.metrics.system.disk.push({ timestamp, value: diskUsage });
    });
    
    // 网络统计
    const networkStats = this.getNetworkStats();
    this.metrics.system.network.push({ timestamp, value: networkStats });
    
    // 保持最近1000个数据点
    this.pruneMetrics('system', 1000);
    
    // 检查阈值告警
    this.checkSystemThresholds();
  }

  // 启动应用指标监控
  startApplicationMetrics() {
    this.applicationMetricsInterval = setInterval(() => {
      this.collectApplicationMetrics();
    }, 5000); // 每5秒收集一次
    
    this.collectApplicationMetrics();
  }

  // 收集应用指标
  collectApplicationMetrics() {
    const timestamp = Date.now();
    
    // 请求计数
    const requestCount = this.getRequestCount();
    this.metrics.application.requestCount.push({ timestamp, value: requestCount });
    
    // 响应时间
    const responseTime = this.getAverageResponseTime();
    this.metrics.application.responseTime.push({ timestamp, value: responseTime });
    
    // 错误率
    const errorRate = this.getErrorRate();
    this.metrics.application.errorRate.push({ timestamp, value: errorRate });
    
    // 活跃连接数
    const activeConnections = this.getActiveConnections();
    this.metrics.application.activeConnections.push({ timestamp, value: activeConnections });
    
    // 保持最近1000个数据点
    this.pruneMetrics('application', 1000);
  }

  // 启动告警处理器
  startAlertProcessor() {
    this.alertProcessorInterval = setInterval(() => {
      this.processAlerts();
    }, 30000); // 每30秒处理一次告警
  }

  // 处理告警
  processAlerts() {
    // 检查告警恢复
    this.checkAlertRecovery();
    
    // 发送告警通知
    this.sendAlertNotifications();
    
    // 清理已解决的告警
    this.cleanupResolvedAlerts();
  }

  // 检查告警恢复
  checkAlertRecovery() {
    this.alerts.forEach(alert => {
      if (alert.acknowledged || alert.resolved) return;
      
      if (alert.type === 'service_unhealthy') {
        const service = this.metrics.services.get(alert.service);
        if (service && service.status === 'healthy') {
          alert.resolved = true;
          alert.resolvedAt = new Date().toISOString();
          
          this.emit('alertResolved', alert);
        }
      }
    });
  }

  // 发送告警通知
  sendAlertNotifications() {
    const criticalAlerts = this.alerts.filter(alert => 
      alert.severity === 'critical' && !alert.acknowledged && !alert.resolved
    );
    
    criticalAlerts.forEach(alert => {
      // 发送邮件、短信、Slack等通知
      this.sendNotification(alert);
    });
  }

  // 检查系统阈值告警
  checkSystemThresholds() {
    const latest = {
      cpu: this.metrics.system.cpu[this.metrics.system.cpu.length - 1],
      memory: this.metrics.system.memory[this.metrics.system.memory.length - 1],
      disk: this.metrics.system.disk[this.metrics.system.disk.length - 1]
    };
    
    // CPU阈值检查
    if (latest.cpu && latest.cpu.value > this.config.alertThresholds.cpu) {
      this.addAlert({
        id: `alert_${Date.now()}_cpu`,
        type: 'threshold_exceeded',
        severity: latest.cpu.value > 90 ? 'critical' : 'warning',
        metric: 'cpu',
        message: `CPU使用率过高: ${latest.cpu.value.toFixed(2)}%`,
        threshold: this.config.alertThresholds.cpu,
        currentValue: latest.cpu.value,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }
    
    // 内存阈值检查
    if (latest.memory && latest.memory.value > this.config.alertThresholds.memory) {
      this.addAlert({
        id: `alert_${Date.now()}_memory`,
        type: 'threshold_exceeded',
        severity: latest.memory.value > 95 ? 'critical' : 'warning',
        metric: 'memory',
        message: `内存使用率过高: ${latest.memory.value.toFixed(2)}%`,
        threshold: this.config.alertThresholds.memory,
        currentValue: latest.memory.value,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }
    
    // 磁盘阈值检查
    if (latest.disk && latest.disk.value > this.config.alertThresholds.disk) {
      this.addAlert({
        id: `alert_${Date.now()}_disk`,
        type: 'threshold_exceeded',
        severity: latest.disk.value > 95 ? 'critical' : 'warning',
        metric: 'disk',
        message: `磁盘使用率过高: ${latest.disk.value.toFixed(2)}%`,
        threshold: this.config.alertThresholds.disk,
        currentValue: latest.disk.value,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }
  }

  // 添加告警
  addAlert(alert) {
    // 检查是否已存在相同类型的未解决告警
    const existing = this.alerts.find(a => 
      a.type === alert.type && 
      a.service === alert.service && 
      !a.resolved
    );
    
    if (!existing) {
      this.alerts.push(alert);
      this.emit('newAlert', alert);
    }
  }

  // 确认告警
  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  // 清理已解决的告警
  cleanupResolvedAlerts() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.alerts = this.alerts.filter(alert => {
      const alertTime = new Date(alert.timestamp).getTime();
      return alertTime > oneDayAgo && (!alert.resolved || alert.resolvedAt > oneDayAgo);
    });
  }

  // 获取监控摘要
  getSummary() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const services = Array.from(this.metrics.services.values()).map(service => ({
      name: service.name,
      status: service.status,
      uptime: service.uptime,
      availability: this.calculateAvailability(service.checks, oneHourAgo),
      responseTime: this.calculateAverageResponseTime(service.checks, oneHourAgo),
      lastCheck: service.lastCheck
    }));
    
    const alerts = {
      total: this.alerts.length,
      critical: this.alerts.filter(a => a.severity === 'critical' && !a.acknowledged && !a.resolved).length,
      warning: this.alerts.filter(a => a.severity === 'warning' && !a.acknowledged && !a.resolved).length
    };
    
    const systemHealth = {
      cpu: this.getLatestMetric('system', 'cpu'),
      memory: this.getLatestMetric('system', 'memory'),
      disk: this.getLatestMetric('system', 'disk')
    };
    
    return {
      timestamp: new Date().toISOString(),
      overallStatus: this.getOverallStatus(services, alerts),
      services,
      alerts,
      systemHealth,
      metrics: {
        system: this.metrics.system,
        application: this.metrics.application
      }
    };
  }

  // 获取整体状态
  getOverallStatus(services, alerts) {
    if (alerts.critical > 0) return 'critical';
    if (alerts.warning > 0) return 'degraded';
    
    const unhealthyServices = services.filter(s => s.status !== 'healthy');
    if (unhealthyServices.length > 0) return 'degraded';
    
    return 'healthy';
  }

  // 计算可用性
  calculateAvailability(checks, since) {
    const recentChecks = checks.filter(check => 
      new Date(check.timestamp).getTime() > since
    );
    
    if (recentChecks.length === 0) return 100;
    
    const healthyChecks = recentChecks.filter(check => check.healthy);
    return (healthyChecks.length / recentChecks.length) * 100;
  }

  // 计算平均响应时间
  calculateAverageResponseTime(checks, since) {
    const recentChecks = checks.filter(check => 
      new Date(check.timestamp).getTime() > since && check.responseTime
    );
    
    if (recentChecks.length === 0) return 0;
    
    const totalResponseTime = recentChecks.reduce((sum, check) => sum + check.responseTime, 0);
    return totalResponseTime / recentChecks.length;
  }

  // 获取最新指标
  getLatestMetric(category, metric) {
    const metrics = this.metrics[category][metric];
    return metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }

  // 清理旧指标
  pruneMetrics(category, maxPoints) {
    Object.keys(this.metrics[category]).forEach(metric => {
      if (Array.isArray(this.metrics[category][metric])) {
        while (this.metrics[category][metric].length > maxPoints) {
          this.metrics[category][metric].shift();
        }
      }
    });
  }

  // 发送通知
  sendNotification(alert) {
    // 这里实现具体的通知逻辑
    console.log(`📢 告警通知: ${alert.severity.toUpperCase()} - ${alert.message}`);
    this.emit('notification', alert);
  }

  // 辅助方法
  getCPUUsage() {
    // 模拟CPU使用率
    return Math.random() * 100;
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    return (usage.heapUsed / usage.heapTotal) * 100;
  }

  async getDiskUsage() {
    // 模拟磁盘使用率
    return Math.random() * 100;
  }

  getNetworkStats() {
    return {
      bytesIn: Math.random() * 1000000,
      bytesOut: Math.random() * 1000000,
      packetsIn: Math.random() * 1000,
      packetsOut: Math.random() * 1000
    };
  }

  getRequestCount() {
    return Math.floor(Math.random() * 100);
  }

  getAverageResponseTime() {
    return Math.random() * 1000;
  }

  getErrorRate() {
    return Math.random() * 10;
  }

  getActiveConnections() {
    return Math.floor(Math.random() * 50);
  }
}

export default SystemMonitor;