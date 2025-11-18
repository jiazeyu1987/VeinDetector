from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import datetime

class ProcessingStatus(str, Enum):
    """处理状态枚�?""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class VeinDetectionResult(BaseModel):
    """静脉检测结�?""
    frame_number: int
    vein_regions: List[Dict[str, Any]] = Field(description="检测到的静脉区域列�?)
    confidence: float = Field(description="检测置信度", ge=0, le=1)
    processing_time: float = Field(description="处理时间(�?")
    
class ROIRegion(BaseModel):
    """ROI区域定义"""
    x: int = Field(description="ROI左上角x坐标")
    y: int = Field(description="ROI左上角y坐标")
    width: int = Field(description="ROI宽度")
    height: int = Field(description="ROI高度")
    
    @property
    def center_x(self) -> int:
        """ROI中心x坐标"""
        return self.x + self.width // 2
    
    @property
    def center_y(self) -> int:
        """ROI中心y坐标"""
        return self.y + self.height // 2

class VideoProcessingTask(BaseModel):
    """视频处理任务"""
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str = Field(description="文件�?)
    file_size: int = Field(description="文件大小(字节)")
    status: ProcessingStatus = Field(default=ProcessingStatus.PENDING)
    total_frames: Optional[int] = Field(default=None, description="总帧�?)
    processed_frames: int = Field(default=0, description="已处理帧�?)
    current_roi: Optional[ROIRegion] = Field(default=None, description="当前ROI")
    detection_results: List[VeinDetectionResult] = Field(default_factory=list, description="检测结果列�?)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    error_message: Optional[str] = Field(default=None)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
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
    progress: float = Field(description="处理进度百分�?, ge=0, le=100)
    current_frame: Optional[int] = Field(default=None)
    total_frames: Optional[int] = Field(default=None)
    estimated_time: Optional[float] = Field(default=None, description="预估剩余时间(�?)" )
    detection_summary: Optional[Dict[str, Any]] = Field(default=None)

    detection_summary: Optional[Dict[str, Any]] = Field(default=None)

class DetectionSettings(BaseModel):
    """检测设置参�?""
    canny_threshold_low: int = Field(default=50, ge=0, le=255)
    canny_threshold_high: int = Field(default=150, ge=0, le=255)
    hough_dp: float = Field(default=1, ge=0.1, le=3.0)
    hough_min_dist: int = Field(default=50, ge=10, le=500)
    hough_param1: int = Field(default=50, ge=10, le=200)
    hough_param2: int = Field(default=30, ge=10, le=100)
    min_vein_area: int = Field(default=100, ge=10, le=5000)
    max_vein_area: int = Field(default=2000, ge=100, le=10000)
    elliptical_tolerance: float = Field(default=0.3, ge=0.1, le=1.0)

class APIResponse(BaseModel):
    """通用API响应"""
    success: bool
    message: str
    data: Optional[Any] = None
    error_code: Optional[str] = None
