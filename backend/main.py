from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import logging
import os
import json
import shutil
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import uuid
import asyncio
import numpy as np
from models import (
    VideoUploadResponse,
    ProcessingProgressResponse,
    APIResponse,
    VideoProcessingTask,
    DetectionSettings,
    ProcessingStatus,
    VeinDetectionResult,
    ROIRegion,
    SamusAnalysisRequest,
    SamusMaskResponse,
    CenterPoint,
)
from video_processor import VideoProcessor
from vein_detector import VeinDetector, VeinRegion
from roi_handler import ROIHandler
# 设置环境变量以避免transformers兼容性问题
import os
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'

from samus_inference import (
    decode_image_from_data_url,
    SamusVeinSegmentor,
    CVVeinSegmentor,
    EnhancedCVVeinSegmentor,
    SimpleCenterCVVeinSegmentor,
    EllipticalMorphSegmentor,
)

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="超声静脉检测系统API",
    description="基于OpenCV的超声静脉检测和跟踪系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建上传目录
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# 创建输出目录
OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

# 静态文件服务
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# 全局组件
video_processor = VideoProcessor(str(UPLOAD_DIR))
vein_detector = VeinDetector()
roi_handler = ROIHandler()

# 静脉分割组件 - 使用原有方式
samus_segmentor = SamusVeinSegmentor()
cv_segmentor = CVVeinSegmentor()
enhanced_cv_segmentor = EnhancedCVVeinSegmentor()
simple_center_segmentor = SimpleCenterCVVeinSegmentor()
elliptical_morph_segmentor = EllipticalMorphSegmentor()

# 任务存储（实际项目中应使用数据库）
processing_tasks: Dict[str, VideoProcessingTask] = {}

# 检测设置存储
detection_settings: Dict[str, DetectionSettings] = {}

@app.get("/", response_model=APIResponse)
async def root():
    return APIResponse(
        success=True,
        message="超声静脉检测系统API 正在运行",
        data={
            "version": "1.0.0",
            "endpoints": {
                "upload": "/upload-video",
                "status": "/processing-status/{task_id}",
                "settings": "/detection-settings",
                "docs": "/docs"
            }
        }
    )

@app.post("/upload-video", response_model=VideoUploadResponse)
async def upload_video(file: UploadFile = File(...)):
    """上传视频文件"""
    try:
        # 检查文件类型
        if not video_processor.is_supported_format(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"不支持的视频格式: {Path(file.filename).suffix}"
            )

        # 检查文件大小(限制500MB)
        content = await file.read()
        file_size = len(content)
        max_size = 500 * 1024 * 1024  # 500MB

        if file_size > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"文件太大，最大允许{max_size // (1024*1024)}MB"
            )

        if file_size == 0:
            raise HTTPException(status_code=400, detail="文件为空")

        # 保存文件
        file_path = video_processor.save_uploaded_video(content, file.filename)
        uploaded_filename = Path(file_path).name
        video_url = f"/uploads/{uploaded_filename}"

        # 获取视频信息
        video_info = video_processor.get_video_info(file_path)

        # 创建任务
        task = VideoProcessingTask(
            filename=file.filename,
            file_size=file_size,
            total_frames=video_info['frame_count']
        )

        processing_tasks[task.task_id] = task
        detection_settings[task.task_id] = DetectionSettings()

        # 启动后台处理
        asyncio.create_task(process_video_background(task.task_id, file_path))

        logger.info(f"视频上传成功: {file.filename}, 任务ID: {task.task_id}")
        return VideoUploadResponse(
            task_id=task.task_id,
            filename=file.filename,
            status=ProcessingStatus.PENDING,
            message="视频上传成功，开始处理...",
            video_url=video_url
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"视频上传失败: {e}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@app.get("/processing-status/{task_id}", response_model=ProcessingProgressResponse)
async def get_processing_status(task_id: str):
    """获取处理进度"""
    if task_id not in processing_tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
 
    task = processing_tasks[task_id]

    # 计算进度
    progress = 0.0
    if task.total_frames:
        progress = (task.processed_frames / task.total_frames) * 100

    # 预估剩余时间
    estimated_time = None
    if progress > 0 and task.processed_frames > 0:
        elapsed_time = (datetime.now() - task.created_at).total_seconds()
        total_estimated = elapsed_time * task.total_frames / task.processed_frames
        estimated_time = total_estimated - elapsed_time

    # 检测摘要
    detection_summary = None
    if task.detection_results:
        total_veins = sum(len(result.vein_regions) for result in task.detection_results)
        avg_confidence = sum(sum(region.get('confidence', 0) for region in result.vein_regions)
                           for result in task.detection_results) / max(total_veins, 1)

        detection_summary = {
            'total_detected_veins': total_veins,
            'average_confidence': avg_confidence,
            'processed_frames': task.processed_frames
        }

    return ProcessingProgressResponse(
        task_id=task_id,
        status=task.status,
        progress=progress,
        current_frame=task.processed_frames,
        total_frames=task.total_frames,
        estimated_time=estimated_time,
        detection_summary=detection_summary
    )

@app.get("/detection-settings", response_model=DetectionSettings)
async def get_detection_settings(task_id: str = Query(None)):
    """获取检测设置"""
    if task_id and task_id in detection_settings:
        return detection_settings[task_id]

    # 返回默认设置
    return DetectionSettings()

@app.put("/detection-settings", response_model=APIResponse)
async def update_detection_settings(settings: DetectionSettings, task_id: str = Query(None)):
    """更新检测设置"""
    if task_id:
        if task_id not in detection_settings:
            raise HTTPException(status_code=404, detail="任务不存在")
        detection_settings[task_id] = settings

        # 更新静脉检测器设置
        if task_id in processing_tasks:
            task = processing_tasks[task_id]
            if task.status == ProcessingStatus.PROCESSING:
                # 如果正在处理，可以动态更新设置
                settings_dict = settings.dict()
                vein_detector.update_settings(settings_dict)
                logger.info(f"任务 {task_id} 的检测设置已动态更新")
    else:
        # 更新全局默认设置
        detection_settings['default'] = settings
        vein_detector.update_settings(settings.dict())
        logger.info("全局检测设置已更新")

    return APIResponse(
        success=True,
        message="检测设置更新成功",
        data=settings.dict()
    )

@app.get("/detection-results/{task_id}")
async def get_detection_results(task_id: str):
    """获取检测结果"""
    if task_id not in processing_tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    task = processing_tasks[task_id]

    # 转换结果为可序列化格式
    results = []
    for result in task.detection_results:
        result_dict = {
            'frame_number': result.frame_number,
            'vein_regions': result.vein_regions,
            'confidence': result.confidence,
            'processing_time': result.processing_time
        }
        results.append(result_dict)

    return {
        'task_id': task_id,
        'status': task.status,
        'total_frames': task.total_frames,
        'processed_frames': task.processed_frames,
        'detection_results': results,
        'roi_center': {
            'x': task.current_roi.center_x if task.current_roi else None,
            'y': task.current_roi.center_y if task.current_roi else None
        } if task.current_roi else None,
        'statistics': roi_handler.get_roi_statistics() if task.current_roi else None
    }

@app.get("/download-results/{task_id}")
async def download_results(task_id: str, format: str = "json"):
    """下载检测结果"""
    if task_id not in processing_tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    task = processing_tasks[task_id]

    if format == "json":
        # 生成JSON结果文件
        results_data = {
            'task_id': task_id,
            'filename': task.filename,
            'created_at': task.created_at.isoformat(),
            'total_frames': task.total_frames,
            'processed_frames': task.processed_frames,
            'detection_results': [result.dict() for result in task.detection_results],
            'statistics': roi_handler.get_roi_statistics() if task.current_roi else None
        }

        output_file = OUTPUT_DIR / f"{task_id}_results.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results_data, f, ensure_ascii=False, indent=2)

        return FileResponse(
            str(output_file),
            media_type='application/json',
            filename=f"{task.filename}_results.json"
        )

    else:
        raise HTTPException(status_code=400, detail="不支持的格式")

@app.delete("/tasks/{task_id}", response_model=APIResponse)
async def delete_task(task_id: str):
    """删除任务"""
    if task_id not in processing_tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    task = processing_tasks[task_id]

    # 清理文件
    try:
        # 这里可以添加清理上传文件的逻辑
        pass
    except Exception as e:
        logger.warning(f"清理文件时出错: {e}")

    # 删除任务
    del processing_tasks[task_id]

    if task_id in detection_settings:
        del detection_settings[task_id]

    return APIResponse(
        success=True,
        message="任务已删除",
        data={'task_id': task_id}
    )

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'components': {
            'video_processor': 'ok',
            'vein_detector': 'ok',
            'roi_handler': 'ok'
        }
    }


@app.post("/analysis/samus", response_model=APIResponse)
async def analyze_frame_with_samus(request: SamusAnalysisRequest):
    """
    使用 SAMUS 模型对当前帧进行静脉分割。
 
    前端输入格式：
    - image_data_url: 当前帧的 data URL（即 canvas.toDataURL）
    - roi: 当前帧上的 ROI 区域
    """
    logger.info(
        "API /analysis/samus called: model=%s, roi=(x=%s,y=%s,w=%s,h=%s), params_keys=%s",
        request.model_name,
        getattr(request.roi, 'x', None),
        getattr(request.roi, 'y', None),
        getattr(request.roi, 'width', None),
        getattr(request.roi, 'height', None),
        list(request.parameters.keys()) if request.parameters else [],
    )
    try:
        image = decode_image_from_data_url(request.image_data_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to decode input frame")
        raise HTTPException(status_code=500, detail="无法解析输入图像") from exc

    # 如果前端选择了传统 CV 分割，直接走 OpenCV 流程
    cv_model_name = (request.model_name or "").lower()
    if cv_model_name in {
        "cv",
        "cv-vein",
        "opencv",
        "cv_enhanced",
        "cv-advanced",
        "cv-frangi",
        "cv_simple_center",
    }:
        try:
            if cv_model_name in {"cv_enhanced", "cv-advanced", "cv-frangi"}:
                mask = enhanced_cv_segmentor.segment(
                    image, request.roi, request.parameters or None
                )
            elif cv_model_name == "cv_simple_center":
                mask = simple_center_segmentor.segment(
                    image, request.roi, request.parameters or None
                )
            else:
                mask = cv_segmentor.segment(image, request.roi, request.parameters or None)
        except Exception as exc:
            logger.exception("CV vein segmentation failed")
            raise HTTPException(status_code=500, detail="静脉分割失败") from exc

        if mask.ndim != 2:
            raise HTTPException(status_code=500, detail="分割结果 mask 维度错误")

        height, width = mask.shape
        response = SamusMaskResponse(
            width=width, height=height, mask=mask.astype(int).tolist()
        )

        return APIResponse(
            success=True,
            message="CV 分割完成",
            data=response.dict(),
        )

    try:
        model_name = (request.model_name or "samus").lower()
        logger.info(f"Using model: {model_name}")

        # 根据前端选择的模型名称路由到不同的分割实现
        if model_name in {"samus", "samus-ultrasound", "unet", "unet++"}:
            mask = samus_segmentor.segment(image, request.roi, request.parameters or None)
        elif model_name in {"cv_enhanced", "cv-frangi"}:
            mask = enhanced_cv_segmentor.segment(image, request.roi, request.parameters or None)
        elif model_name in {"cv_simple_center"}:
            mask = simple_center_segmentor.segment(image, request.roi, request.parameters or None)
        elif model_name in {"elliptical_morph", "ellipse_morph", "ellipse_threshold"}:
            # 获取前端传递的参数
            parameters = {}
            if hasattr(request, 'parameters') and request.parameters:
                parameters = request.parameters
            mask = elliptical_morph_segmentor.segment(image, request.roi, parameters)
        else:
            logger.warning(f"未知模型名称 {model_name}，回退到 SAMUS")
            mask = samus_segmentor.segment(image, request.roi, request.parameters or None)

    except Exception as exc:
        logger.exception("Vein segmentation failed")
        raise HTTPException(status_code=500, detail="静脉分割失败") from exc

    if mask.ndim != 2:
        raise HTTPException(status_code=500, detail="分割结果 mask 维度错误")

    height, width = mask.shape

    # 生成ROI中心采样点信息
    center_points = []
    sampling_points = [
        {"x": int(width * 0.25), "y": int(height * 0.25), "label": "左上"},
        {"x": int(width * 0.25), "y": int(height * 0.75), "label": "左下"},
        {"x": int(width * 0.5), "y": int(height * 0.5), "label": "中心"},
        {"x": int(width * 0.75), "y": int(height * 0.25), "label": "右上"},
        {"x": int(width * 0.75), "y": int(height * 0.75), "label": "右下"}
    ]

    for point in sampling_points:
        in_mask = (point["y"] < height and point["x"] < width and mask[point["y"], point["x"]] == 1)
        center_points.append(CenterPoint(
            x=point["x"],
            y=point["y"],
            label=point["label"],
            in_mask=in_mask
        ))

    # 检查连通域参数
    roi_center_connected = False
    max_connected_component = False
    if request.parameters:
        roi_center_connected = request.parameters.get("roi_center_connected_component_enabled", 0) == 1
        max_connected_component = request.parameters.get("max_connected_component_enabled", 0) == 1

    # 构建处理信息
    processing_info = {
        "algorithm": model_name,
        "roi_size": f"{width}x{height}",
        "total_pixels": int(np.sum(mask)),
        "roi_center_connected_enabled": roi_center_connected,
        "max_connected_component_enabled": max_connected_component
    }

    response = SamusMaskResponse(
        width=width,
        height=height,
        mask=mask.astype(int).tolist(),
        center_points=[cp.dict() for cp in center_points],
        roi_center_connected=roi_center_connected,
        max_connected_component=max_connected_component,
        processing_info=processing_info
    )

    return APIResponse(
        success=True,
        message=f"{model_name} 分割完成",
        data=response.dict(),
    )

async def process_video_background(task_id: str, file_path: str):
    """后台视频处理任务"""
    try:
        task = processing_tasks[task_id]
        task.status = ProcessingStatus.PROCESSING
        task.updated_at = datetime.now()

        logger.info(f"开始处理任务 {task_id}")

        # 获取视频信息
        video_info = video_processor.get_video_info(file_path)
        task.total_frames = video_info['frame_count']

        # 初始化ROI
        frame_width = video_info['width']
        frame_height = video_info['height']
        initial_center = (frame_width // 2, frame_height // 2)
        roi_handler.initialize_roi(
            initial_center[0], initial_center[1],
            frame_width, frame_height
        )

        # 处理每一帧
        frame_count = 0
        for frame_number, frame in video_processor.extract_frames(file_path, target_fps=8.0):
            if task.status == ProcessingStatus.FAILED:
                break

            # 预处理帧
            processed_frame = video_processor.preprocess_frame(frame)

            # 获取当前ROI
            current_roi = roi_handler.current_roi

            # 检测静脉
            vein_regions = vein_detector.detect_veins_in_frame(processed_frame, current_roi)

            # 更新ROI
            vein_centers = [(region.center[0], region.center[1]) for region in vein_regions]
            roi_info = {'existing_regions': [{'center': region.center} for region in vein_regions]}

            new_roi = roi_handler.update_roi(processed_frame, vein_centers, roi_info)

            # 转换为可序列化格式
            vein_regions_data = []
            for region in vein_regions:
                region_dict = {
                    'center': region.center,
                    'radius': region.radius,
                    'area': region.area,
                    'perimeter': region.perimeter,
                    'ellipticity': region.ellipticity,
                    'confidence': region.confidence,
                    'bbox': region.bbox
                }
                vein_regions_data.append(region_dict)

            # 计算检测置信度
            overall_confidence = sum(region.confidence for region in vein_regions) / max(len(vein_regions), 1)

            # 创建结果
            detection_result = VeinDetectionResult(
                frame_number=frame_number,
                vein_regions=vein_regions_data,
                confidence=overall_confidence,
                processing_time=0.0  # 可以从vein_detector获取
            )

            task.detection_results.append(detection_result)
            task.processed_frames = frame_number + 1
            task.current_roi = ROIRegion(
                x=new_roi[0],
                y=new_roi[1],
                width=new_roi[2],
                height=new_roi[3]
            )

            task.updated_at = datetime.now()
            frame_count += 1

            # 每10帧记录一次日志
            if frame_count % 10 == 0:
                logger.info(f"任务 {task_id}: 已处理 {frame_count} 帧，检测到 {len(vein_regions)} 个静脉区域")

            # 控制处理速度，避免过度消耗CPU
            await asyncio.sleep(0.01)

        task.status = ProcessingStatus.COMPLETED
        logger.info(f"任务 {task_id} 处理完成，共处理 {frame_count} 帧")

    except Exception as e:
        logger.error(f"任务 {task_id} 处理失败: {e}")
        task.status = ProcessingStatus.FAILED
        task.error_message = str(e)
        task.updated_at = datetime.now()

if __name__ == "__main__":
    # 运行服务器
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
