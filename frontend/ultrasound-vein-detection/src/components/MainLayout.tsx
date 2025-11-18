import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Play, Pause, Square, Settings, BarChart3, Camera, FileVideo } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { ROIEditor } from './ROIEditor';
import { VeinVisualization } from './VeinVisualization';
import { apiClient, mockApi } from '../api/client';
import { VideoInfo, ROI, VeinDetectionResult } from '../api/types';

export const MainLayout: React.FC = () => {
  const [currentVideo, setCurrentVideo] = useState<VideoInfo | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentROI, setCurrentROI] = useState<ROI | null>(null);
  const [detectionResults, setDetectionResults] = useState<VeinDetectionResult[]>([]);
  const [currentDetection, setCurrentDetection] = useState<VeinDetectionResult | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [segmentationMask, setSegmentationMask] = useState<number[][] | null>(null);
  const [showSegmentationOverlay, setShowSegmentationOverlay] = useState(true);
  // 当前实际使用的是 segmentation_models_pytorch 提供的 U-Net (ResNet34, ImageNet encoder)
  const [segmentationModel, setSegmentationModel] = useState('smp_unet_resnet34');
  const previewUrlRef = useRef<string | null>(null);
  const revokeBlobUrl = useCallback((url?: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const [showVisualization, setShowVisualization] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);

  const [leftPanelSize, setLeftPanelSize] = useState(70);
  const [rightPanelSize, setRightPanelSize] = useState(30);
  const [isResizing, setIsResizing] = useState(false);
  const [frameStep, setFrameStep] = useState(1);
  const [showROIOverlay, setShowROIOverlay] = useState(true);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayedTotalFrames = currentVideo ? Math.max(1, Math.floor(currentVideo.frameCount / frameStep)) : 0;
  const timeAxisProgress =
    displayedTotalFrames > 1 ? (currentFrame / (displayedTotalFrames - 1)) * 100 : 0;

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        setLoading(true);
        setError(null);
        const response = await mockApi.uploadVideo(file);
        if (response.success && response.data) {
          revokeBlobUrl(previewUrlRef.current);
          previewUrlRef.current = response.data.videoUrl;
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
    },
    [revokeBlobUrl],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      const videoFile = files.find(file => file.type.startsWith('video/'));
      if (videoFile) {
        handleFileUpload(videoFile);
      }
    },
    [handleFileUpload],
  );

  useEffect(() => {
    return () => {
      revokeBlobUrl(previewUrlRef.current);
    };
  }, [revokeBlobUrl]);

  // 当前简单分割逻辑不依赖历史检测结果
  useEffect(() => {
    setCurrentDetection(undefined);
  }, [currentFrame]);

  const startAnalysis = useCallback(async () => {
    if (!currentVideo || !currentROI) {
      setError('请先选择视频和ROI区域');
      return;
    }
    if (!frameCanvasRef.current) {
      setError('当前帧画布尚未准备好，请稍后重试');
      return;
    }
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setError(null);
      const canvas = frameCanvasRef.current;
      const imageDataUrl = canvas.toDataURL('image/png');
      const response = await apiClient.segmentCurrentFrame({
        imageDataUrl,
        roi: currentROI,
        modelName: segmentationModel,
      });
      if (response.success && response.data) {
        setSegmentationMask(response.data.mask);
        setIsAnalyzing(false);
        setAnalysisProgress(100);
      } else {
        setError(response.error || response.message || '分析启动失败');
        setIsAnalyzing(false);
      }
    } catch (err) {
      setError('分析失败: ' + (err as Error).message);
      setIsAnalyzing(false);
    }
  }, [currentVideo, currentROI, segmentationModel]);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const container = document.getElementById('main-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newLeftSize = ((e.clientX - rect.left) / rect.width) * 100;
      if (newLeftSize >= 40 && newLeftSize <= 80) {
        setLeftPanelSize(newLeftSize);
        setRightPanelSize(100 - newLeftSize);
      }
    },
    [isResizing],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

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
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [startAnalysis, showVisualization, currentROI]);

  return (
    <div
      id="main-container"
      className="h-screen bg-gray-900 text-white flex flex-col"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
            <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded cursor-pointer flex items-center space-x-2 transition-colors">
              <Upload size={16} />
              <span>上传视频</span>
              <input
                type="file"
                accept="video/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />
            </label>
            <div className="flex items-center space-x-2 text-sm text-gray-200 mr-2">
              <span>分割模型:</span>
              <select
                value={segmentationModel}
                onChange={e => setSegmentationModel(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
              >
                <option value="smp_unet_resnet34">
                  深度模型 · SMP U-Net (ResNet34)
                </option>
                <option value="cv">传统 CV 分割 (OpenCV)</option>
              </select>
            </div>
            <button
              onClick={startAnalysis}
              disabled={!currentVideo || !currentROI || isAnalyzing}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center space-x-2 transition-colors"
            >
              <BarChart3 size={16} />
              <span>{isAnalyzing ? `分析中... ${analysisProgress}%` : '开始分析'}</span>
            </button>
            <button
              onClick={() => setShowSegmentationOverlay(prev => !prev)}
              disabled={!segmentationMask}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center space-x-2 transition-colors"
            >
              <span>{showSegmentationOverlay ? '隐藏分割结果' : '显示分割结果'}</span>
            </button>
            <button className="p-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors">
              <Settings size={16} />
            </button>
          </div>
        </div>
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

      <div className="flex-1 flex overflow-hidden">
        <div
          className="bg-gray-800 border-r border-gray-700 flex flex-col"
          style={{ width: `${leftPanelSize}%` }}
        >
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <span>抽帧:</span>
                  <select
                    value={frameStep}
                    onChange={e => {
                      const value = parseInt(e.target.value, 10) || 1;
                      setFrameStep(value);
                      setCurrentFrame(0);
                    }}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
                  >
                    <option value={1}>每帧</option>
                    <option value={2}>每2帧</option>
                    <option value={5}>每5帧</option>
                    <option value={10}>每10帧</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-300">
                  {currentFrame + 1} / {displayedTotalFrames}
                </div>
                {currentROI && (
                  <div className="text-xs bg-blue-600 px-2 py-1 rounded">
                    ROI已设置
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {!currentVideo ? (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-600 rounded">
                <div className="text-center">
                  <Camera size={48} className="mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400 mb-2">请上传超声视频文件</p>
                  <p className="text-sm text-gray-500">支持 MP4, AVI, MOV 格式</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative mx-auto" style={{ width: 800, height: 600 }}>
                  <VideoPlayer
                    videoUrl={currentVideo.videoUrl}
                    currentFrame={currentFrame}
                    totalFrames={displayedTotalFrames}
                    onFrameChange={setCurrentFrame}
                    onTimeUpdate={() => {}}
                    frameStep={frameStep}
                    width={800}
                    height={600}
                    className="w-full h-full"
                    onCanvasRef={canvas => {
                      frameCanvasRef.current = canvas;
                    }}
                  />
                  <div className="absolute inset-0">
                    <ROIEditor
                      imageWidth={800}
                      imageHeight={600}
                      currentROI={currentROI}
                      onROIChange={setCurrentROI}
                      onROIClear={() => setCurrentROI(null)}
                      className="w-full h-full"
                    />
                    {segmentationMask && showSegmentationOverlay && (
                      <canvas
                        className="absolute inset-0 pointer-events-none"
                        ref={canvas => {
                          if (!canvas) return;
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          const width = 800;
                          const height = 600;
                          canvas.width = width;
                          canvas.height = height;
                          ctx.clearRect(0, 0, width, height);
                          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                          for (let y = 0; y < segmentationMask.length; y += 1) {
                            const row = segmentationMask[y];
                            for (let x = 0; x < row.length; x += 1) {
                              if (row[x]) {
                                ctx.fillRect(x, y, 1, 1);
                              }
                            }
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="mx-auto w-full max-w-[800px] px-2">
                  <div className="flex items-center justify-between mb-2 text-xs text-gray-200">
                    <span>时间轴</span>
                    <span>
                      帧 {currentFrame + 1} / {displayedTotalFrames}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() =>
                        setCurrentFrame(prev => Math.max(0, prev - 1))
                      }
                      disabled={currentFrame === 0}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                    >
                      上一帧
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, displayedTotalFrames - 1)}
                      value={currentFrame}
                      onChange={e => {
                        const value = parseInt(e.target.value, 10);
                        if (!Number.isNaN(value)) {
                          setCurrentFrame(value);
                        }
                      }}
                      className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <button
                      onClick={() =>
                        setCurrentFrame(prev =>
                          Math.min(displayedTotalFrames - 1, prev + 1),
                        )
                      }
                      disabled={currentFrame >= displayedTotalFrames - 1}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                    >
                      下一帧
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
          onMouseDown={handleMouseDown}
        />

        <div
          className="bg-gray-800 flex flex-col"
          style={{ width: `${rightPanelSize}%` }}
        >
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-medium">检测结果</h2>
            {detectionResults.length > 0 && (
              <div className="text-sm text-gray-400 mt-1">共 {detectionResults.length} 帧结果</div>
            )}
          </div>
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

      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center space-x-4">
            <span>快捷键: Ctrl+R 清除ROI | Ctrl+A 开始分析 | Ctrl+V 显示/隐藏结果</span>
          </div>
          <div>{loading ? '加载中...' : '就绪'}</div>
        </div>
      </div>
    </div>
  );
};
