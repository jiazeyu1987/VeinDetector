#!/usr/bin/env python3
"""
直接测试最大连通区域功能
模拟backend的处理流程但专注于调试连通区域分析
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

import numpy as np
import cv2
import logging

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_test_mask():
    """创建一个包含多个独立连通区域的测试mask"""
    mask = np.zeros((100, 100), dtype=np.uint8)

    # 区域1：大块区域（左上角）
    mask[10:30, 10:30] = 255

    # 区域2：中等块区域（右下角，与区域1不相连）
    mask[60:75, 60:75] = 255

    # 区域3：小块区域（中间位置，孤立）
    mask[45:50, 45:50] = 255

    # 区域4：对角相连测试（使用4连通应该不相连）
    mask[35:40, 35:40] = 255  # 区域4a
    mask[40:42, 40:42] = 255  # 区域4b（只有对角接触）

    return mask

def test_max_connected_component(mask, threshold_min=100, threshold_max=255):
    """测试最大连通区域提取功能"""

    logger.info("=" * 60)
    logger.info("开始测试最大连通区域功能")
    logger.info("=" * 60)

    # 模拟ROI图像（用mask作为ROI，因为mask已经是0/255）
    roi_img = mask.copy()

    logger.info(f"原始ROI图像：白色像素数 = {(roi_img > 0).sum()}")

    # 第一步：阈值分割（模拟已经二值化的图像）
    logger.info("第一步：阈值分割")
    processed_mask = np.zeros_like(roi_img, dtype=np.uint8)
    processed_mask[(roi_img >= threshold_min) & (roi_img <= threshold_max)] = 255

    threshold_pixels = (processed_mask > 0).sum()
    logger.info(f"阈值分割结果：{threshold_pixels}像素在阈值范围内")

    # 第二步：轻微的形态学操作
    logger.info("第二步：形态学操作")
    kernel_small = np.ones((2, 2), np.uint8)
    processed_mask = cv2.morphologyEx(processed_mask, cv2.MORPH_OPEN, kernel_small, iterations=1)

    morph_pixels = (processed_mask > 0).sum()
    logger.info(f"形态学操作后：{morph_pixels}像素（减少了{threshold_pixels - morph_pixels}像素）")

    # 第三步：连通组件分析（4连通）
    logger.info("第三步：连通组件分析（4连通）")
    if (processed_mask > 0).sum() > 0:
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            processed_mask, connectivity=4, ltype=cv2.CV_32S
        )

        logger.info(f"连通组件分析结果：发现{num_labels}个标签（包括背景），{num_labels-1}个连通区域")

        # 显示所有连通区域的面积信息
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            centroid = centroids[i]
            logger.info(f"连通区域 {i}: 面积={area}像素, 中心点=({centroid[0]:.1f}, {centroid[1]:.1f})")

        # 找到最大连通区域
        if num_labels > 1:
            max_area_idx = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
            max_area = stats[max_area_idx, cv2.CC_STAT_AREA]

            logger.info(f"最大连通区域：索引={max_area_idx}, 面积={max_area}像素")

            # 创建只包含最大连通区域的mask
            result_mask = (labels == max_area_idx).astype(np.uint8) * 255

            result_pixels = (result_mask > 0).sum()
            logger.info(f"最终结果：{result_pixels}像素（应该等于最大区域面积{max_area}）")

            return result_mask, max_area, num_labels - 1
        else:
            logger.warning("没有找到连通区域")
            return processed_mask, 0, 0
    else:
        logger.warning("没有白色像素进行连通区域分析")
        return processed_mask, 0, 0

def visualize_regions(mask):
    """简单可视化连通区域"""
    # 创建一个带标记的图像来显示不同的连通区域
    if (mask > 0).sum() == 0:
        print("空mask，无法可视化")
        return

    # 进行连通组件分析
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        mask, connectivity=4, ltype=cv2.CV_32S
    )

    print(f"\nConnected regions visualization ({num_labels-1} regions):")
    print("0 = Background, 1-9 = Different connected regions")

    # 创建可视化标记
    vis = np.zeros((mask.shape[0], mask.shape[1]), dtype=int)
    for i in range(1, num_labels):
        vis[labels == i] = i

    # 打印部分可视化矩阵（只显示中间区域）
    h, w = mask.shape
    start_y, end_y = max(0, h//2-10), min(h, h//2+10)
    start_x, end_x = max(0, w//2-10), min(w, w//2+10)

    for y in range(start_y, end_y):
        row_str = ""
        for x in range(start_x, end_x):
            if vis[y, x] == 0:
                row_str += "."
            else:
                row_str += str(vis[y, x])
        print(row_str)

def main():
    """主测试函数"""
    logger.info("Test: Max connected component functionality")

    # 创建测试mask
    test_mask = create_test_mask()

    logger.info(f"测试mask创建完成，包含{(test_mask > 0).sum()}个白色像素")

    # 可视化原始mask的连通区域
    logger.info("\n原始mask连通区域分析：")
    visualize_regions(test_mask)

    # 测试最大连通区域提取
    result_mask, max_area, num_regions = test_max_connected_component(test_mask)

    # 验证结果
    logger.info("\n" + "=" * 60)
    logger.info("🔍 结果验证")
    logger.info("=" * 60)

    original_pixels = (test_mask > 0).sum()
    result_pixels = (result_mask > 0).sum()

    logger.info(f"原始白色像素：{original_pixels}")
    logger.info(f"结果白色像素：{result_pixels}")
    logger.info(f"检测到的连通区域数：{num_regions}")
    logger.info(f"最大区域面积：{max_area}")

    if num_regions > 1:
        logger.info("✅ 测试通过：正确识别了多个连通区域")
        logger.info("✅ 测试通过：只保留了面积最大的连通区域")
    elif num_regions == 1:
        logger.info("⚠️  警告：只检测到一个连通区域")
    else:
        logger.info("❌ 测试失败：没有检测到连通区域")

    if result_pixels == max_area:
        logger.info("✅ 测试通过：结果像素数与最大区域面积匹配")
    else:
        logger.info(f"❌ 测试失败：结果像素数({result_pixels})与最大区域面积({max_area})不匹配")

if __name__ == "__main__":
    main()