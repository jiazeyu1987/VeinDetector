from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, Field


class ProcessingStatus(str, Enum):
    """处理状态枚举"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class VeinDetectionResult(BaseModel):
    """静脉检测结果（视频离线分析使用）"""

    frame_number: int
    vein_regions: List[Dict[str, Any]] = Field(
        default_factory=list, description="检测到的静脉区域列表"
    )
    confidence: float = Field(description="检测置信度", ge=0.0, le=1.0)
    processing_time: float = Field(description="处理时间(秒)")


class ROIRegion(BaseModel):
    """ROI 区域定义"""

    x: int = Field(description="ROI 左上角 x 坐标")
    y: int = Field(description="ROI 左上角 y 坐标")
    width: int = Field(description="ROI 宽度")
    height: int = Field(description="ROI 高度")

    @property
    def center_x(self) -> int:
        """ROI 中心 x 坐标"""
        return self.x + self.width // 2

    @property
    def center_y(self) -> int:
        """ROI 中心 y 坐标"""
        return self.y + self.height // 2


class SamusAnalysisRequest(BaseModel):
    """
    单帧分割请求（当前用于 SMP U-Net / 传统 CV / 增强 CV 等多种分割模式）
    """

    image_data_url: str = Field(description="前端 canvas.toDataURL 导出的当前帧图像")
    roi: ROIRegion = Field(description="当前帧上的 ROI 区域")
    model_name: str = Field(
        default="smp_unet_resnet34",
        description=(
            "分割模型名称，例如 'smp_unet_resnet34'（segmentation_models_pytorch "
            "Unet + ResNet34 encoder），或 'cv'、'cv_enhanced' 等"
        ),
    )
    parameters: Optional[Dict[str, Any]] = Field(
        default=None,
        description="可选的分割参数（例如阈值、面积过滤范围等）",
    )


class SamusMaskResponse(BaseModel):
    """静脉分割结果（简化为 0/1 mask）"""

    width: int = Field(description="图像宽度（像素）")
    height: int = Field(description="图像高度（像素）")
    mask: List[List[int]] = Field(description="二维 0/1 掩码，与图像同宽高")


class VideoProcessingTask(BaseModel):
    """视频处理任务（离线整段视频分析）"""

    task_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), description="任务 ID（UUID）"
    )
    filename: str = Field(description="文件名")
    file_size: int = Field(description="文件大小(字节)")
    status: ProcessingStatus = Field(default=ProcessingStatus.PENDING)
    total_frames: Optional[int] = Field(default=None, description="总帧数")
    processed_frames: int = Field(default=0, description="已处理帧数")
    current_roi: Optional[ROIRegion] = Field(default=None, description="当前 ROI")
    detection_results: List[VeinDetectionResult] = Field(
        default_factory=list, description="检测结果列表"
    )
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    error_message: Optional[str] = Field(default=None)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


class VideoUploadResponse(BaseModel):
    """视频上传响应"""

    task_id: str
    filename: str
    status: ProcessingStatus
    message: str
    video_url: str


class ProcessingProgressResponse(BaseModel):
    """处理进度响应"""

    task_id: str
    status: ProcessingStatus
    progress: float = Field(description="处理进度百分比", ge=0.0, le=100.0)
    current_frame: Optional[int] = Field(default=None)
    total_frames: Optional[int] = Field(default=None)
    estimated_time: Optional[float] = Field(
        default=None, description="预估剩余时间(秒)"
    )
    detection_summary: Optional[Dict[str, Any]] = Field(default=None)


class DetectionSettings(BaseModel):
    """传统检测（VeinDetector）使用的参数"""

    canny_threshold_low: int = Field(default=50, ge=0, le=255)
    canny_threshold_high: int = Field(default=150, ge=0, le=255)
    hough_dp: float = Field(default=1.0, ge=0.1, le=3.0)
    hough_min_dist: int = Field(default=50, ge=10, le=500)
    hough_param1: int = Field(default=50, ge=10, le=200)
    hough_param2: int = Field(default=30, ge=10, le=100)
    min_vein_area: int = Field(default=100, ge=10, le=5000)
    max_vein_area: int = Field(default=2000, ge=100, le=10000)
    elliptical_tolerance: float = Field(default=0.3, ge=0.1, le=1.0)


class APIResponse(BaseModel):
    """通用 API 响应"""

    success: bool
    message: str
    data: Optional[Any] = None
    error_code: Optional[str] = None

