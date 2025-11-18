import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, Square, Settings, BarChart3, Camera, FileVideo } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { ROIEditor } from './ROIEditor';
import { VeinVisualization } from './VeinVisualization';
import { apiClient, mockApi } from '../api/client';
import { 
  VideoInfo, 
  ROI, 
  VeinDetectionResult, 
  AnalysisRequest,
  AnalysisResponse,
  JobStatus
} from '../api/types';

export const MainLayout: React.FC = () => {
  // 状态管理
  const [currentVideo, setCurrentVideo] = useState<VideoInfo | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentROI, setCurrentROI] = useState<ROI | null>(null);
  const [detectionResults, setDetectionResults] = useState<VeinDetectionResult[]>([]);
  const [currentDetection, setCurrentDetection] = useState<VeinDetectionResult | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisJob, setAnalysisJob] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 可视化设置
  const [showVisualization, setShowVisualization] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);

  // 面板控制
  const [leftPanelSize, setLeftPanelSize] = useState(70); // 左侧视频面板大小
  const [rightPanelSize, setRightPanelSize] = useState(30); // 右侧结果面板大小
  const [isResizing, setIsResizing] = useState(false);

  // 文件上传处理
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      
      // 模拟上传过程
      const response = await mockApi.uploadVideo(file);
      
      if (response.success && response.data) {
        setCurrentVideo(response.data);
        setCurrentFrame(0);
        setCurrentROI(null);
        setDetectionResults([]);
        setCurrentDetection(undefined);
      } else {
        setError(response.error || '视频上传失败');
      }
    } catch (err) {
      setError('视频上传失败: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 拖拽上传支持
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      handleFileUpload(videoFile);
    }
  }, [handleFileUpload]);

  // 开始分析
  const startAnalysis = useCallback(async () => {
    if (!currentVideo || !currentROI) {
      setError('请先选择视频和ROI区域');
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setError(null);

      const request: AnalysisRequest = {
        videoId: currentVideo.id,
        roi: currentROI,
        parameters: {
          threshold: confidenceThreshold,
          minVeinSize: 10,
          maxVeinSize: 100,
        },
      };

      const response = await mockApi.startAnalysis(request);
      
      if (response.success && response.data) {
        setAnalysisJob(response.data.jobId);
        
        // 模拟分析进度
        const progressInterval = setInterval(async () => {
          setAnalysisProgress(prev => {
            const newProgress = Math.min(prev + 10, 100);
            
            if (newProgress >= 100) {
              clearInterval(progressInterval);
              // 获取分析结果
              fetchAnalysisResults(response.data!.jobId);
            }
            
            return newProgress;
          });
        }, 500);
      } else {
        setError(response.error || '分析启动失败');
        setIsAnalyzing(false);
      }
    } catch (err) {
      setError('分析失败: ' + (err as Error).message);
      setIsAnalyzing(false);
    }
  }, [currentVideo, currentROI, confidenceThreshold]);

  // 获取分析结果
  const fetchAnalysisResults = useCallback(async (jobId: string) => {
    try {
      const response = await mockApi.getAnalysisResults(jobId);
      
      if (response.success && response.data) {
        setDetectionResults(response.data);
        setIsAnalyzing(false);
        setAnalysisProgress(100);
      } else {
        setError(response.error || '获取分析结果失败');
        setIsAnalyzing(false);
      }
    } catch (err) {
      setError('获取分析结果失败: ' + (err as Error).message);
      setIsAnalyzing(false);
    }
  }, []);

  // 更新当前帧的检测结果
  useEffect(() => {
    const result = detectionResults.find(r => r.frameIndex === currentFrame);
    setCurrentDetection(result);
  }, [currentFrame, detectionResults]);

  // 面板调整
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const container = document.getElementById('main-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newLeftSize = ((e.clientX - rect.left) / rect.width) * 100;
    
    if (newLeftSize >= 40 && newLeftSize <= 80) {
      setLeftPanelSize(newLeftSize);
      setRightPanelSize(100 - newLeftSize);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'KeyR':
          if (e.ctrlKey) {
            e.preventDefault();
            if (currentROI) {
              setCurrentROI(null);
            }
          }
          break;
        case 'KeyA':
          if (e.ctrlKey) {
            e.preventDefault();
            startAnalysis();
          }
          break;
        case 'KeyV':
          if (e.ctrlKey) {
            e.preventDefault();
            setShowVisualization(!showVisualization);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [startAnalysis, showVisualization]);

  return (
    <div 
      id="main-container"
      className="h-screen bg-gray-900 text-white flex flex-col"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 顶部工具栏 */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-blue-400">超声静脉检测系统</h1>
            {currentVideo && (
              <div className="text-sm text-gray-300">
                <FileVideo size={16} className="inline mr-1" />
                {currentVideo.name}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* 文件上传 */}
            <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded cursor-pointer flex items-center space-x-2 transition-colors">
              <Upload size={16} />
              <span>上传视频</span>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />
            </label>

            {/* 分析按钮 */}
            <button
              onClick={startAnalysis}
              disabled={!currentVideo || !currentROI || isAnalyzing}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center space-x-2 transition-colors"
            >
              <BarChart3 size={16} />
              <span>
                {isAnalyzing ? `分析中... ${analysisProgress}%` : '开始分析'}
              </span>
            </button>

            {/* 设置按钮 */}
            <button className="p-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors">
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-3 p-3 bg-red-600 bg-opacity-20 border border-red-600 rounded text-red-200">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-200 hover:text-white"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧视频面板 */}
        <div 
          className="bg-gray-800 border-r border-gray-700 flex flex-col"
          style={{ width: `${leftPanelSize}%` }}
        >
          {/* 视频控制栏 */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={!currentVideo}
                  className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={() => setCurrentROI(null)}
                  disabled={!currentROI}
                  className="p-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                >
                  <Square size={16} />
                </button>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-300">
                  {currentFrame + 1} / {currentVideo?.frameCount || 0}
                </div>
                {currentROI && (
                  <div className="text-xs bg-blue-600 px-2 py-1 rounded">
                    ROI已设置
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 视频显示区域 */}
          <div className="flex-1 p-4 overflow-auto">
            {!currentVideo ? (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-600 rounded">
                <div className="text-center">
                  <Camera size={48} className="mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400 mb-2">请上传超声视频文件</p>
                  <p className="text-sm text-gray-500">
                    支持 MP4, AVI, MOV 格式
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 视频播放器 */}
                <VideoPlayer
                  currentFrame={currentFrame}
                  totalFrames={currentVideo.frameCount}
                  onFrameChange={setCurrentFrame}
                  onTimeUpdate={() => {}}
                  isPlaying={isPlaying}
                  onPlayPause={() => setIsPlaying(!isPlaying)}
                  width={800}
                  height={600}
                  className="mx-auto"
                />

                {/* ROI编辑 */}
                <ROIEditor
                  imageWidth={800}
                  imageHeight={600}
                  currentROI={currentROI}
                  onROIChange={setCurrentROI}
                  onROIClear={() => setCurrentROI(null)}
                  className="mx-auto"
                />
              </div>
            )}
          </div>
        </div>

        {/* 调整手柄 */}
        <div
          className="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
          onMouseDown={handleMouseDown}
        />

        {/* 右侧结果面板 */}
        <div 
          className="bg-gray-800 flex flex-col"
          style={{ width: `${rightPanelSize}%` }}
        >
          {/* 结果面板标题 */}
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-medium">检测结果</h2>
            {detectionResults.length > 0 && (
              <div className="text-sm text-gray-400 mt-1">
                共 {detectionResults.length} 帧结果
              </div>
            )}
          </div>

          {/* 结果可视化 */}
          <div className="flex-1 p-4">
            {currentVideo && showVisualization ? (
              <VeinVisualization
                imageWidth={800}
                imageHeight={600}
                detectionResult={currentDetection}
                visible={showVisualization}
                onToggleVisibility={() => setShowVisualization(!showVisualization)}
                showContours={showContours}
                showCenters={showCenters}
                onToggleContours={() => setShowContours(!showContours)}
                onToggleCenters={() => setShowCenters(!showCenters)}
                confidenceThreshold={confidenceThreshold}
                onConfidenceThresholdChange={setConfidenceThreshold}
                className="h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-600 rounded">
                <div className="text-center text-gray-400">
                  {currentVideo ? '检测结果可视化已隐藏' : '请先上传视频'}
                </div>
              </div>
            )}
          </div>

          {/* 分析进度 */}
          {isAnalyzing && (
            <div className="p-4 border-t border-gray-700">
              <div className="mb-2">
                <div className="flex justify-between text-sm">
                  <span>分析进度</span>
                  <span>{analysisProgress}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2 mt-1">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center space-x-4">
            <span>快捷键: Ctrl+R 清除ROI | Ctrl+A 开始分析 | Ctrl+V 显示/隐藏结果</span>
          </div>
          <div>
            {loading ? '加载中...' : '就绪'}
          </div>
        </div>
      </div>
    </div>
  );
};