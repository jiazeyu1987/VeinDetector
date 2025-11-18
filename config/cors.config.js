// CORS配置 - 前后端集成跨域处理
export const corsConfig = {
  // 开发环境配置
  development: {
    origin: [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Access-Token',
      'X-Key',
      'Cache-Control',
      'Range'
    ],
    exposedHeaders: [
      'Content-Length',
      'Content-Range',
      'X-Content-Range'
    ],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 200
  },
  
  // 生产环境配置
  production: {
    origin: [
      'https://your-domain.com',
      'https://www.your-domain.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Access-Token',
      'X-Key',
      'Cache-Control',
      'Range'
    ],
    exposedHeaders: [
      'Content-Length',
      'Content-Range',
      'X-Content-Range'
    ],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 200
  }
};

// API代理配置
export const proxyConfig = {
  // 前端代理配置
  frontend: {
    target: process.env.FRONTEND_URL || 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
    pathRewrite: {
      '^/api/': '/'
    }
  },
  
  // 后端代理配置
  backend: {
    target: process.env.BACKEND_URL || 'http://localhost:8000',
    changeOrigin: true,
    secure: false,
    pathRewrite: {
      '^/api/': '/'
    },
    onProxyReq: (proxyReq: any, req: any, res: any) => {
      // 添加请求头
      proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
      proxyReq.setHeader('X-Forwarded-Host', req.get('host'));
    }
  },
  
  // 视频服务代理配置
  videoService: {
    target: process.env.VIDEO_SERVICE_URL || 'http://localhost:8080',
    changeOrigin: true,
    secure: false,
    pathRewrite: {
      '^/video/': '/'
    },
    onProxyReq: (proxyReq: any, req: any, res: any) => {
      // 大文件上传配置
      proxyReq.setHeader('Connection', 'keep-alive');
    }
  }
};

// WebSocket配置
export const websocketConfig = {
  path: '/ws',
  transports: ['websocket', 'polling'],
  cors: {
    origin: corsConfig.development.origin,
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
};

// 健康检查配置
export const healthCheckConfig = {
  endpoint: '/health',
  timeout: 5000,
  interval: 30000,
  retries: 3,
  services: {
    frontend: {
      url: 'http://localhost:3000/health',
      expectedStatus: 200
    },
    backend: {
      url: 'http://localhost:8000/health',
      expectedStatus: 200
    },
    videoService: {
      url: 'http://localhost:8080/health',
      expectedStatus: 200
    }
  }
};

// 文件上传配置
export const uploadConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedTypes: [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/quicktime',
    'video/x-msvideo',
    'application/octet-stream'
  ],
  tempDir: '/tmp/uploads',
  cleanupInterval: 30 * 60 * 1000, // 30分钟
  maxConcurrentUploads: 5
};

export default {
  cors: corsConfig,
  proxy: proxyConfig,
  websocket: websocketConfig,
  healthCheck: healthCheckConfig,
  upload: uploadConfig
};