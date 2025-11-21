import React from 'react';
import { VeinDetectionResult } from '../../api/types';
import { VeinVisualization } from '../VeinVisualization';

interface ResultsPanelProps {
  currentVideo: any;
  showVisualization: boolean;
  showSettingsPanel: boolean;
  currentDetection: VeinDetectionResult | undefined;
  detectionResults: VeinDetectionResult[];
  showContours: boolean;
  showCenters: boolean;
  confidenceThreshold: number;
  onToggleVisualization: () => void;
  onToggleContours: () => void;
  onToggleCenters: () => void;
  onConfidenceThresholdChange: (threshold: number) => void;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  currentVideo,
  showVisualization,
  showSettingsPanel,
  currentDetection,
  detectionResults,
  showContours,
  showCenters,
  confidenceThreshold,
  onToggleVisualization,
  onToggleContours,
  onToggleCenters,
  onConfidenceThresholdChange,
}) => {
  return (
    <>
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-medium">检测结果</h2>
        {detectionResults.length > 0 && (
          <div className="text-sm text-gray-400 mt-1">共 {detectionResults.length} 帧结果</div>
        )}
      </div>
      <div className={`flex-1 p-4 ${showSettingsPanel ? 'hidden' : ''}`}>
        {currentVideo && showVisualization ? (
          <VeinVisualization
            imageWidth={800}
            imageHeight={600}
            detectionResult={currentDetection}
            visible={showVisualization}
            onToggleVisibility={onToggleVisualization}
            showContours={showContours}
            showCenters={showCenters}
            onToggleContours={onToggleContours}
            onToggleCenters={onToggleCenters}
            confidenceThreshold={confidenceThreshold}
            onConfidenceThresholdChange={onConfidenceThresholdChange}
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
    </>
  );
};