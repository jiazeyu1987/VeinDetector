// 错误处理和日志记录系统
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import path from 'path';

class ErrorHandler {
  constructor(options = {}) {
    this.logger = this.createLogger(options);
    this.errorQueue = [];
    this.retryConfig = options.retryConfig || {
      maxRetries: 3,
      retryDelay: 1000,
      backoffFactor: 2
    };
    this.notificationChannels = options.notificationChannels || [];
  }

  createLogger(options) {
    const logDir = options.logDir || './logs';
    
    // 确保日志目录存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta
          });
        })
      ),
      defaultMeta: { service: 'vein-detection-system' },
      transports: [
        // 控制台输出
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),

        // 错误日志文件
        new DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        }),

        // 综合日志文件
        new DailyRotateFile({
          filename: path.join(logDir, 'combined-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),

        // 访问日志
        new DailyRotateFile({
          filename: path.join(logDir, 'access-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'http',
          maxSize: '20m',
          maxFiles: '7d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),

        // 性能日志
        new DailyRotateFile({
          filename: path.join(logDir, 'performance-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'verbose',
          maxSize: '20m',
          maxFiles: '30d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ],

      // 异常处理
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'exceptions.log')
        })
      ],
      
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'rejections.log')
        })
      ],

      // 进程退出时刷新日志
      exitOnError: false
    });

    return logger;
  }

  // 错误分类
  categorizeError(error) {
    const categories = {
      VALIDATION_ERROR: 'ValidationError',
      NETWORK_ERROR: 'NetworkError', 
      PROCESSING_ERROR: 'ProcessingError',
      SYSTEM_ERROR: 'SystemError',
      TIMEOUT_ERROR: 'TimeoutError',
      STORAGE_ERROR: 'StorageError',
      PERMISSION_ERROR: 'PermissionError',
      CONFIGURATION_ERROR: 'ConfigurationError'
    };

    // 根据错误类型和消息进行分类
    if (error.name === 'ValidationError' || error.message?.includes('验证')) {
      return categories.VALIDATION_ERROR;
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.message?.includes('网络')) {
      return categories.NETWORK_ERROR;
    }
    
    if (error.message?.includes('超时')) {
      return categories.TIMEOUT_ERROR;
    }
    
    if (error.code === 'ENOENT' || error.message?.includes('文件')) {
      return categories.STORAGE_ERROR;
    }
    
    if (error.message?.includes('权限')) {
      return categories.PERMISSION_ERROR;
    }
    
    if (error.message?.includes('配置')) {
      return categories.CONFIGURATION_ERROR;
    }
    
    if (error.message?.includes('处理') || error.message?.includes('processing')) {
      return categories.PROCESSING_ERROR;
    }
    
    return categories.SYSTEM_ERROR;
  }

  // 错误严重性级别
  getSeverityLevel(error, context = {}) {
    const category = this.categorizeError(error);
    const severityLevels = {
      [categories.VALIDATION_ERROR]: 'low',
      [categories.NETWORK_ERROR]: 'medium',
      [categories.PROCESSING_ERROR]: 'high',
      [categories.SYSTEM_ERROR]: 'critical',
      [categories.TIMEOUT_ERROR]: 'medium',
      [categories.STORAGE_ERROR]: 'high',
      [categories.PERMISSION_ERROR]: 'medium',
      [categories.CONFIGURATION_ERROR]: 'high'
    };

    let severity = severityLevels[category] || 'medium';

    // 根据上下文调整严重性
    if (context.criticalPath) {
      if (severity === 'low') severity = 'medium';
      if (severity === 'medium') severity = 'high';
      if (severity === 'high') severity = 'critical';
    }

    if (context.userImpact === 'high') {
      if (severity === 'low') severity = 'medium';
      if (severity === 'medium') severity = 'high';
    }

    return severity;
  }

  // 处理错误
  async handleError(error, context = {}) {
    const errorId = this.generateErrorId();
    const category = this.categorizeError(error);
    const severity = this.getSeverityLevel(error, context);
    const timestamp = new Date().toISOString();

    const errorInfo = {
      errorId,
      category,
      severity,
      message: error.message || 'Unknown error',
      stack: error.stack,
      context,
      timestamp,
      status: 'open'
    };

    // 记录错误日志
    this.logError(error, errorInfo);

    // 添加到错误队列
    this.errorQueue.push(errorInfo);

    // 根据严重性级别处理
    await this.processErrorBySeverity(errorInfo);

    // 自动重试（如果适用）
    if (this.shouldRetry(error, context)) {
      await this.scheduleRetry(error, context);
    }

    // 发送通知
    await this.sendNotifications(errorInfo);

    // 错误恢复尝试
    await this.attemptRecovery(error, context);

    return errorId;
  }

  // 记录错误日志
  logError(error, errorInfo) {
    const logData = {
      errorId: errorInfo.errorId,
      category: errorInfo.category,
      severity: errorInfo.severity,
      context: errorInfo.context,
      timestamp: errorInfo.timestamp
    };

    switch (errorInfo.severity) {
      case 'critical':
        this.logger.error(error.message, { ...logData, stack: error.stack });
        break;
      case 'high':
        this.logger.error(error.message, { ...logData, stack: error.stack });
        break;
      case 'medium':
        this.logger.warn(error.message, logData);
        break;
      case 'low':
        this.logger.info(error.message, logData);
        break;
    }
  }

  // 根据严重性处理错误
  async processErrorBySeverity(errorInfo) {
    switch (errorInfo.severity) {
      case 'critical':
        // 立即发送通知
        await this.sendCriticalNotification(errorInfo);
        // 可能需要触发系统降级
        await this.triggerSystemDegradation(errorInfo);
        break;
        
      case 'high':
        // 快速通知
        await this.sendHighPriorityNotification(errorInfo);
        // 检查系统健康状态
        await this.checkSystemHealth(errorInfo);
        break;
        
      case 'medium':
        // 标准日志记录
        // 可能需要监控
        break;
        
      case 'low':
        // 常规日志记录
        break;
    }
  }

  // 判断是否应该重试
  shouldRetry(error, context) {
    // 不重试验证错误和权限错误
    const noRetryCategories = ['ValidationError', 'PermissionError', 'ConfigurationError'];
    
    if (noRetryCategories.includes(this.categorizeError(error))) {
      return false;
    }

    // 检查是否有重试上下文
    return context.retryable !== false && context.maxRetries > 0;
  }

  // 安排重试
  async scheduleRetry(error, context) {
    const retryCount = context.retryCount || 0;
    
    if (retryCount >= context.maxRetries) {
      this.logger.warn('重试次数已用完，停止重试', {
        errorId: error.message,
        retryCount,
        maxRetries: context.maxRetries
      });
      return;
    }

    // 指数退避
    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffFactor, retryCount);
    
    setTimeout(async () => {
      try {
        await context.retryFunction?.();
      } catch (retryError) {
        await this.handleError(retryError, {
          ...context,
          retryCount: retryCount + 1,
          originalError: error
        });
      }
    }, delay);
  }

  // 发送通知
  async sendNotifications(errorInfo) {
    for (const channel of this.notificationChannels) {
      try {
        await this.sendToChannel(channel, errorInfo);
      } catch (notificationError) {
        this.logger.error('通知发送失败', {
          channel: channel.type,
          errorId: errorInfo.errorId,
          error: notificationError.message
        });
      }
    }
  }

  // 发送到具体通道
  async sendToChannel(channel, errorInfo) {
    const message = this.formatNotificationMessage(errorInfo);
    
    switch (channel.type) {
      case 'email':
        await this.sendEmail(channel, message, errorInfo);
        break;
      case 'slack':
        await this.sendSlack(channel, message, errorInfo);
        break;
      case 'webhook':
        await this.sendWebhook(channel, errorInfo);
        break;
      case 'sms':
        await this.sendSMS(channel, message, errorInfo);
        break;
    }
  }

  // 格式化通知消息
  formatNotificationMessage(errorInfo) {
    return {
      title: `静脉检测系统错误 - ${errorInfo.severity.toUpperCase()}`,
      message: errorInfo.message,
      errorId: errorInfo.errorId,
      category: errorInfo.category,
      timestamp: errorInfo.timestamp,
      context: errorInfo.context,
      severity: errorInfo.severity
    };
  }

  // 错误恢复尝试
  async attemptRecovery(error, context) {
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'NetworkError':
        await this.recoverNetworkError(error, context);
        break;
      case 'StorageError':
        await this.recoverStorageError(error, context);
        break;
      case 'ProcessingError':
        await this.recoverProcessingError(error, context);
        break;
    }
  }

  // 网络错误恢复
  async recoverNetworkError(error, context) {
    this.logger.info('尝试网络错误恢复', { errorId: error.message });
    
    // 检查网络连接
    const isOnline = await this.checkNetworkConnectivity();
    if (!isOnline) {
      this.logger.warn('网络仍然不可用，跳过恢复');
      return;
    }
    
    // 重置连接池
    if (context.connection) {
      await context.connection.reset();
    }
  }

  // 存储错误恢复
  async recoverStorageError(error, context) {
    this.logger.info('尝试存储错误恢复', { errorId: error.message });
    
    // 检查磁盘空间
    const diskSpace = await this.checkDiskSpace();
    if (diskSpace.percentage > 90) {
      this.logger.warn('磁盘空间不足，尝试清理临时文件');
      await this.cleanupTempFiles();
    }
  }

  // 处理错误恢复
  async recoverProcessingError(error, context) {
    this.logger.info('尝试处理错误恢复', { errorId: error.message });
    
    // 清理缓存
    if (context.cache) {
      await context.cache.clear();
    }
    
    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
  }

  // 检查系统健康状态
  async checkSystemHealth(errorInfo) {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {}
    };
    
    try {
      // 检查CPU使用率
      healthStatus.checks.cpu = {
        status: 'healthy',
        value: await this.getCPUUsage()
      };
      
      // 检查内存使用率
      healthStatus.checks.memory = {
        status: 'healthy',
        value: await this.getMemoryUsage()
      };
      
      // 检查磁盘空间
      healthStatus.checks.disk = {
        status: 'healthy',
        value: await this.checkDiskSpace()
      };
      
      // 检查数据库连接
      healthStatus.checks.database = {
        status: 'healthy',
        value: await this.checkDatabaseConnection()
      };
      
      // 确定整体状态
      const unhealthyChecks = Object.values(healthStatus.checks).filter(check => check.status !== 'healthy');
      if (unhealthyChecks.length > 0) {
        healthStatus.status = 'unhealthy';
      }
      
    } catch (checkError) {
      healthStatus.status = 'error';
      healthStatus.error = checkError.message;
    }
    
    // 记录健康检查结果
    this.logger.info('系统健康检查', healthStatus);
    
    return healthStatus;
  }

  // 生成错误ID
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取错误统计
  getErrorStats(timeRange = '24h') {
    const now = Date.now();
    const timeRangeMs = this.parseTimeRange(timeRange);
    
    const filteredErrors = this.errorQueue.filter(error => 
      now - new Date(error.timestamp).getTime() < timeRangeMs
    );
    
    const stats = {
      total: filteredErrors.length,
      byCategory: {},
      bySeverity: {},
      byHour: {},
      recentErrors: filteredErrors.slice(-10)
    };
    
    filteredErrors.forEach(error => {
      // 按类别统计
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      
      // 按严重性统计
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // 按小时统计
      const hour = new Date(error.timestamp).getHours();
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    });
    
    return stats;
  }

  // 解析时间范围
  parseTimeRange(timeRange) {
    const unit = timeRange.slice(-1);
    const value = parseInt(timeRange.slice(0, -1));
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000; // 默认24小时
    }
  }

  // 辅助方法（需要根据实际环境实现）
  async sendCriticalNotification(errorInfo) {
    this.logger.critical('发送关键错误通知', errorInfo);
  }

  async sendHighPriorityNotification(errorInfo) {
    this.logger.warn('发送高优先级错误通知', errorInfo);
  }

  async triggerSystemDegradation(errorInfo) {
    this.logger.critical('触发系统降级', errorInfo);
  }

  async sendEmail(channel, message, errorInfo) {
    this.logger.info('发送邮件通知', { channel: channel.type, errorId: errorInfo.errorId });
  }

  async sendSlack(channel, message, errorInfo) {
    this.logger.info('发送Slack通知', { channel: channel.type, errorId: errorInfo.errorId });
  }

  async sendWebhook(channel, errorInfo) {
    this.logger.info('发送Webhook通知', { channel: channel.type, errorId: errorInfo.errorId });
  }

  async sendSMS(channel, message, errorInfo) {
    this.logger.info('发送短信通知', { channel: channel.type, errorId: errorInfo.errorId });
  }

  async checkNetworkConnectivity() {
    return Math.random() > 0.3; // 模拟检查
  }

  async checkDiskSpace() {
    return { percentage: Math.random() * 100, free: 1024 * 1024 * 1024 };
  }

  async cleanupTempFiles() {
    this.logger.info('清理临时文件');
  }

  async getCPUUsage() {
    return Math.random() * 100;
  }

  async getMemoryUsage() {
    return process.memoryUsage();
  }

  async checkDatabaseConnection() {
    return { status: 'connected', responseTime: Math.random() * 100 };
  }
}

const categories = {
  VALIDATION_ERROR: 'ValidationError',
  NETWORK_ERROR: 'NetworkError', 
  PROCESSING_ERROR: 'ProcessingError',
  SYSTEM_ERROR: 'SystemError',
  TIMEOUT_ERROR: 'TimeoutError',
  STORAGE_ERROR: 'StorageError',
  PERMISSION_ERROR: 'PermissionError',
  CONFIGURATION_ERROR: 'ConfigurationError'
};

export { ErrorHandler, categories };
export default ErrorHandler;