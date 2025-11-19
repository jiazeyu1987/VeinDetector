import {
  VideoInfo,
  VeinDetectionResult,
  ROI,
  ApiResponse,
  AnalysisRequest,
  AnalysisResponse,
  JobStatus,
  VeinData,
  SamusSegmentationResponse,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

class ApiClient {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // 获取视频信息
  async getVideoInfo(videoId: string): Promise<ApiResponse<VideoInfo>> {
    return this.request<ApiResponse<VideoInfo>>(`/videos/${videoId}/info`);
  }

  // 获取视频帧
  async getVideoFrame(videoId: string, frameIndex: number): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}/frames/${frameIndex}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch frame: ${response.status}`);
    }
    return response.blob();
  }

  // 上传视频
  async uploadVideo(file: File): Promise<ApiResponse<VideoInfo>> {
    const formData = new FormData();
    formData.append('video', file);
    
    return this.request<ApiResponse<VideoInfo>>('/videos/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // 让浏览器自动设置Content-Type
    });
  }

  // 开始静脉检测分析
  async startAnalysis(request: AnalysisRequest): Promise<ApiResponse<AnalysisResponse>> {
    return this.request<ApiResponse<AnalysisResponse>>('/analysis/start', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // 获取分析任务状态
  async getJobStatus(jobId: string): Promise<ApiResponse<JobStatus>> {
    return this.request<ApiResponse<JobStatus>>(`/analysis/status/${jobId}`);
  }

  // 获取分析结果
  async getAnalysisResults(jobId: string): Promise<ApiResponse<VeinDetectionResult[]>> {
    return this.request<ApiResponse<VeinDetectionResult[]>>(`/analysis/results/${jobId}`);
  }

  // 使用 SAMUS 对当前帧进行分割（直接调用后端 FastAPI）
  async segmentCurrentFrame(payload: {
    imageDataUrl: string;
    roi: ROI;
    modelName: string;
    parameters?: Record<string, number>;
  }): Promise<ApiResponse<SamusSegmentationResponse>> {
    const response = await fetch(`${BACKEND_BASE_URL}/analysis/samus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_data_url: payload.imageDataUrl,
        roi: {
          x: Math.round(payload.roi.x),
          y: Math.round(payload.roi.y),
          width: Math.round(payload.roi.width),
          height: Math.round(payload.roi.height),
        },
        model_name: payload.modelName,
        parameters: payload.parameters,
      }),
    });

    if (!response.ok) {
      throw new Error(`SAMUS segmentation failed: ${response.status}`);
    }

    return response.json();
  }

  // 获取特定帧的检测结果
  async getFrameResults(videoId: string, frameIndex: number): Promise<ApiResponse<VeinDetectionResult>> {
    return this.request<ApiResponse<VeinDetectionResult>>(
      `/videos/${videoId}/frames/${frameIndex}/results`
    );
  }

  // 获取所有帧的检测结果
  async getAllResults(videoId: string): Promise<ApiResponse<VeinDetectionResult[]>> {
    return this.request<ApiResponse<VeinDetectionResult[]>>(`/videos/${videoId}/results`);
  }

  // 保存ROI
  async saveROI(videoId: string, roi: ROI): Promise<ApiResponse<ROI>> {
    return this.request<ApiResponse<ROI>>(`/videos/${videoId}/roi`, {
      method: 'POST',
      body: JSON.stringify(roi),
    });
  }

  // 获取ROI
  async getROI(videoId: string): Promise<ApiResponse<ROI>> {
    return this.request<ApiResponse<ROI>>(`/videos/${videoId}/roi`);
  }

  // 删除ROI
  async deleteROI(videoId: string): Promise<ApiResponse<void>> {
    return this.request<ApiResponse<void>>(`/videos/${videoId}/roi`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();

// 模拟数据，用于开发和测试
const generateContourPoints = (centerX: number, centerY: number, radius: number) => {
  const points = [];
  const numPoints = 20;
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 5;
    const y = centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 5;
    points.push({ x, y });
  }
  
  return points;
};

export const mockApi = {
  // 模拟视频信息
  getVideoInfo: async (videoId: string): Promise<ApiResponse<VideoInfo>> => {
    await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
    return {
      success: true,
      data: {
        id: videoId,
        name: '超声静脉检测视频.mp4',
        duration: 30, // 30秒
        frameCount: 900, // 30fps * 30秒
        fps: 30,
        width: 1920,
        height: 1080,
      },
    };
  },

  // 模拟帧数据
  getVideoFrame: async (videoId: string, frameIndex: number): Promise<Blob> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    // 这里应该返回实际的视频帧图片数据
    // 为了演示，我们返回一个小的测试图片
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // 创建测试图像
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, 800, 600);
      
      // 添加一些测试内容
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(100, 100, 600, 400);
      
      ctx.fillStyle = '#cbd5e0';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`第 ${frameIndex + 1} 帧`, 400, 300);
      ctx.fillText('超声图像区域', 400, 350);
    }
    
    return new Promise(resolve => {
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8);
    });
  },

  // 模拟上传视频
  uploadVideo: async (file: File): Promise<ApiResponse<VideoInfo>> => {
    await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟上传时间
    
    // 生成一个唯一的视频ID
    const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const previewUrl = URL.createObjectURL(file);
    
    return {
      success: true,
      data: {
        id: videoId,
        name: file.name,
        duration: 30,
        frameCount: 900,
        fps: 30,
        width: 1920,
        height: 1080,
        videoUrl: previewUrl,
      },
    };
  },

  // 模拟开始分析
  startAnalysis: async (request: AnalysisRequest): Promise<ApiResponse<AnalysisResponse>> => {
    await new Promise(resolve => setTimeout(resolve, 500)); // 模拟分析启动时间
    
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      data: {
        jobId,
        status: 'processing',
        progress: 0,
      },
    };
  },

  // 模拟静脉检测结果
  getAnalysisResults: async (jobId: string): Promise<ApiResponse<VeinDetectionResult[]>> => {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟处理时间
    
    const results: VeinDetectionResult[] = [];
    
    // 生成模拟的静脉检测结果
    for (let i = 0; i < 900; i += 30) { // 每30帧生成一个结果
      const veins: VeinData[] = [
        {
          id: `vein1_${i}`,
          centerX: 200 + Math.random() * 400,
          centerY: 150 + Math.random() * 300,
          radius: 15 + Math.random() * 10,
          confidence: 0.8 + Math.random() * 0.2,
          contour: generateContourPoints(200 + Math.random() * 400, 150 + Math.random() * 300, 15 + Math.random() * 10),
        },
        {
          id: `vein2_${i}`,
          centerX: 400 + Math.random() * 300,
          centerY: 200 + Math.random() * 200,
          radius: 12 + Math.random() * 8,
          confidence: 0.7 + Math.random() * 0.3,
          contour: generateContourPoints(400 + Math.random() * 300, 200 + Math.random() * 200, 12 + Math.random() * 8),
        },
      ];
      
      results.push({
        frameIndex: i,
        veins,
      });
    }
    
    return {
      success: true,
      data: results,
    };
  },

  // 导出生成轮廓点的函数供其他地方使用
  generateContourPoints,
};
