#!/usr/bin/env python3
"""
超声静脉检测系统测试脚本
"""

import asyncio
import httpx
import json
import time
from pathlib import Path

async def test_vein_detection_system():
    """测试静脉检测系统"""
    base_url = "http://localhost:8000"
    
    print("🔬 超声静脉检测系统功能测试")
    print("=" * 50)
    
    # 测试1: 健康检查
    print("1. 测试健康检查...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/health")
            if response.status_code == 200:
                print("✅ 健康检查通过")
                print(f"   响应: {response.json()}")
            else:
                print("❌ 健康检查失败")
    except Exception as e:
        print(f"❌ 无法连接到服务器: {e}")
        print("   请确保后端服务正在运行 (python main.py)")
        return
    
    # 测试2: API文档检查
    print("\n2. 测试API文档...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/")
            if response.status_code == 200:
                print("✅ API文档可访问")
                print(f"   系统信息: {response.json()['message']}")
            else:
                print("❌ API文档访问失败")
    except Exception as e:
        print(f"❌ API文档测试失败: {e}")
    
    # 测试3: 检测设置API
    print("\n3. 测试检测设置API...")
    try:
        async with httpx.AsyncClient() as client:
            # 获取默认设置
            response = await client.get(f"{base_url}/detection-settings")
            if response.status_code == 200:
                settings = response.json()
                print("✅ 获取检测设置成功")
                print(f"   Canny低阈值: {settings['canny_threshold_low']}")
                print(f"   Canny高阈值: {settings['canny_threshold_high']}")
                
                # 更新设置
                new_settings = {
                    "canny_threshold_low": 60,
                    "canny_threshold_high": 180,
                    "min_vein_area": 120
                }
                response = await client.put(f"{base_url}/detection-settings", json=new_settings)
                if response.status_code == 200:
                    print("✅ 更新检测设置成功")
                else:
                    print("❌ 更新检测设置失败")
            else:
                print("❌ 获取检测设置失败")
    except Exception as e:
        print(f"❌ 检测设置测试失败: {e}")
    
    # 测试4: 视频上传测试（如果有测试视频）
    print("\n4. 测试视频上传功能...")
    test_video_path = Path("../user_input_files/11月17日(1)-1.mp4")
    
    if test_video_path.exists():
        try:
            async with httpx.AsyncClient() as client:
                with open(test_video_path, 'rb') as f:
                    files = {"file": (test_video_path.name, f, "video/mp4")}
                    response = await client.post(f"{base_url}/upload-video", files=files)
                    
                    if response.status_code == 200:
                        upload_result = response.json()
                        task_id = upload_result["task_id"]
                        print(f"✅ 视频上传成功")
                        print(f"   任务ID: {task_id}")
                        print(f"   文件名: {upload_result['filename']}")
                        
                        # 监控处理进度
                        print("\n5. 监控处理进度...")
                        max_attempts = 30  # 最多等待30次
                        for attempt in range(max_attempts):
                            await asyncio.sleep(2)
                            
                            progress_response = await client.get(f"{base_url}/processing-status/{task_id}")
                            if progress_response.status_code == 200:
                                progress = progress_response.json()
                                print(f"   进度: {progress['progress']:.1f}% - 状态: {progress['status']}")
                                
                                if progress['status'] == 'completed':
                                    print("✅ 处理完成！")
                                    
                                    # 获取检测结果
                                    results_response = await client.get(f"{base_url}/detection-results/{task_id}")
                                    if results_response.status_code == 200:
                                        results = results_response.json()
                                        total_veins = sum(len(r['vein_regions']) for r in results['detection_results'])
                                        print(f"✅ 检测结果获取成功")
                                        print(f"   总帧数: {results['total_frames']}")
                                        print(f"   已处理帧数: {results['processed_frames']}")
                                        print(f"   检测到静脉区域: {total_veins}")
                                        
                                        if results.get('roi_center'):
                                            roi = results['roi_center']
                                            print(f"   ROI中心: ({roi['x']}, {roi['y']})")
                                        
                                        if results.get('statistics'):
                                            stats = results['statistics']
                                            print(f"   ROI统计: 稳定率 {stats['stability_rate']:.2%}")
                                    
                                    break
                                elif progress['status'] == 'failed':
                                    print(f"❌ 处理失败: {progress}")
                                    break
                            else:
                                print(f"   ⚠️ 获取进度失败 (尝试 {attempt + 1}/{max_attempts})")
                        
                        if attempt >= max_attempts - 1:
                            print("⏰ 监控超时，可能需要手动检查处理状态")
                        
                    else:
                        print(f"❌ 视频上传失败: {response.text}")
            except Exception as e:
                print(f"❌ 视频上传测试失败: {e}")
    else:
        print("⚠️ 未找到测试视频文件，跳过视频上传测试")
        print(f"   期望路径: {test_video_path}")
    
    print("\n🎉 测试完成！")
    print("\n📋 使用说明:")
    print("   1. 启动后端服务: python main.py")
    print("   2. 访问API文档: http://localhost:8000/docs")
    print("   3. 上传视频文件进行检测")
    print("   4. 监控处理进度和查看结果")

def test_component_imports():
    """测试组件导入"""
    print("🔧 测试组件导入...")
    
    try:
        from models import VideoProcessingTask, DetectionSettings
        print("✅ models.py - 数据模型导入成功")
    except Exception as e:
        print(f"❌ models.py - 导入失败: {e}")
    
    try:
        from video_processor import VideoProcessor
        processor = VideoProcessor()
        print("✅ video_processor.py - 视频处理器导入成功")
    except Exception as e:
        print(f"❌ video_processor.py - 导入失败: {e}")
    
    try:
        from vein_detector import VeinDetector
        detector = VeinDetector()
        print("✅ vein_detector.py - 静脉检测器导入成功")
    except Exception as e:
        print(f"❌ vein_detector.py - 导入失败: {e}")
    
    try:
        from roi_handler import ROIHandler
        handler = ROIHandler()
        print("✅ roi_handler.py - ROI处理器导入成功")
    except Exception as e:
        print(f"❌ roi_handler.py - 导入失败: {e}")

if __name__ == "__main__":
    print("开始系统测试...\n")
    
    # 测试组件导入
    test_component_imports()
    print()
    
    # 测试系统功能
    asyncio.run(test_vein_detection_system())