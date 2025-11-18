// Jest测试配置文件
const path = require('path');

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.js',
    '<rootDir>/tests/**/*.spec.ts'
  ],
  
  // 忽略的测试文件
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/tmp/'
  ],
  
  // 覆盖率收集配置
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.test.{js,ts}',
    '!src/**/*.spec.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
    '!src/**/*.enum.ts',
    '!src/**/index.{js,ts}'
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/core/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/algorithms/': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary'
  ],
  
  // 覆盖率输出目录
  coverageDirectory: 'coverage',
  
  // 报告输出目录
  outputDirectory: 'test-results',
  
  // 测试超时时间
  testTimeout: 30000,
  
  // 全局设置文件
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // 测试前处理
  globalSetup: '<rootDir>/tests/globalSetup.js',
  
  // 测试后清理
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  
  // 模块路径映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1'
  },
  
  // 模块文件扩展名
  moduleFileExtensions: [
    'js',
    'json',
    'node',
    'ts'
  ],
  
  // 转换配置
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest'
  },
  
  // 转换忽略模式
  transformIgnorePatterns: [
    'node_modules/(?!(axios)/)'
  ],
  
  // 模拟文件映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // 模拟配置
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // 详细输出
  verbose: true,
  
  // 运行器
  runner: 'jest-runner',
  
  // 通知配置（仅在CI环境中）
  notify: process.env.CI === 'true',
  notifyMode: 'failure-change',
  
  // 错误时停止
  bail: false,
  
  // 并行配置
  maxWorkers: '50%',
  maxConcurrency: 5,
  
  // 测试结果处理器
  testResultsProcessor: 'jest-sonar-reporter',
  
  // 自定义匹配器
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // 环境变量
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // 测试环境选项
  testEnvironmentOptions: {
    // Node.js环境选项
  },
  
  // 报告器配置
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: 'false',
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }],
    ['jest-html-reporters', {
      publicPath: './test-results',
      filename: 'report.html',
      pageTitle: 'Vein Detection System Test Report',
      hideIcon: true,
      expand: true
    }]
  ],
  
  // 错误重试配置
  testRunner: 'jest-circus/runner',
  
  // 测试框架配置
  testRunnerOptions: {
    bail: false,
    verbose: true
  },
  
  // 代码覆盖率报告配置
  coverageProvider: 'v8',
  
  // 模拟全局变量
  globals: {
    '__TESTING__': true,
    '__DEV__': process.env.NODE_ENV === 'development'
  },
  
  // 路径配置
  roots: [
    '<rootDir>',
    '<rootDir>/src',
    '<rootDir>/tests'
  ],
  
  // 缓存配置
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // 清除缓存
  clearCache: false,
  
  // 检测打开的句柄
  detectOpenHandles: true,
  
  // 强制退出
  forceExit: true,
  
  // 测试顺序
  runInBand: false,
  
  // 设置测试名称模式
  testNamePattern: '',
  
  // 测试路径模式
  testPathPattern: '',
  
  // 未通过测试的显示模式
  showSeed: false,
  
  // 基准测试配置
  benchmark: false,
  
  // 内存泄漏检测
  detectLeaks: false,
  
  // 错误时详细输出
  errorOnDeprecated: false,
  
  // 单个测试的最大断点数量
  maxConcurrency: 5,
  
  // 测试工作器配置
  workerIdleMemoryLimit: '1GB',
  
  // 监控文件变更
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/'
  ],
  
  // 监视插件
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // 项目配置（多项目测试）
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/unit/**/*.test.{js,ts}'],
      testTimeout: 10000
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.{js,ts}'],
      testTimeout: 30000,
      setupFilesAfterEnv: ['<rootDir>/tests/setup.integration.js']
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/tests/performance/**/*.test.{js,ts}'],
      testTimeout: 60000,
      setupFilesAfterEnv: ['<rootDir>/tests/setup.performance.js']
    }
  ],
  
  // 基准测试配置
  testEnvironment: 'node',
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  
  // 自定义解析器
  resolver: '<rootDir>/tests/resolver.js',
  
  // 自定义快照解析器
  snapshotResolver: '<rootDir>/tests/snapshotResolver.js',
  
  // 快照序列化程序
  snapshotSerializers: [
    'enzyme-to-json/serializer'
  ],
  
  // 自定义断言库
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // 测试结果处理器选项
  testResultsProcessorOptions: {
    failOnError: true
  },
  
  // 基准测试配置
  runInBand: false,
  
  // 检测内存泄漏
  detectLeaks: process.env.NODE_ENV === 'development',
  
  // 强制退出
  forceExit: true,
  
  // 清除模拟
  clearMocks: true,
  
  // 重置模拟
  resetMocks: true,
  
  // 恢复模拟
  restoreMocks: true,
  
  // 报告器配置
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml'
    }],
    ['jest-html-reporters', {
      publicPath: './test-results',
      filename: 'report.html'
    }]
  ],
  
  // 覆盖率报告配置
  coverageReporters: {
    html: {
      subdir: 'html'
    },
    lcov: {
      subdir: 'lcov'
    }
  },
  
  // 基准测试配置
  runInBand: false,
  
  // 性能配置
  maxWorkers: Math.ceil(require('os').cpus().length * 0.75),
  
  // 缓存配置
  cache: true,
  
  // 缓存目录
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // 清除缓存
  clearCache: false,
  
  // 项目配置
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/unit/**/*.test.{js,ts}']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.{js,ts}'],
      testTimeout: 30000
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.{js,ts}'],
      testTimeout: 60000
    }
  ],
  
  // 基准测试配置
  testRunner: 'jest-circus/runner',
  
  // 自定义配置
  customExportConditions: [
    'node',
    'node-addons'
  ],
  
  // 基准测试选项
  testRunnerOptions: {
    bail: false,
    verbose: true,
    runInBand: false
  }
};