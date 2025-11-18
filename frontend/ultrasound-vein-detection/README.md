# 超声静脉检测系统前端

基于React + TypeScript开发的现代化超声静脉检测系统，采用VSCode风格的深色主题界面。

## ✨ 功能特性

### 🎥 视频播放功能
- **完整视频控制**: 播放、暂停、帧导航、音量控制
- **高精度帧控制**: 支持逐帧浏览，精确到30fps
- **键盘快捷键**: 空格键播放/暂停，方向键帧导航
- **进度显示**: 实时显示当前帧和总帧数

### 🎯 ROI交互功能
- **智能绘制**: 点击拖拽快速绘制ROI区域
- **灵活调整**: 8个控制点支持精确尺寸调整
- **位置拖拽**: 支持ROI整体移动定位
- **实时预览**: 蓝色框线实时显示当前ROI
- **快捷操作**: Ctrl+R快速清除ROI

### 🔍 静脉检测可视化
- **高亮显示**: 蓝色轮廓清晰标记检测到的静脉
- **中心标记**: 蓝色圆点精确标记静脉中心位置
- **置信度显示**: 实时显示检测置信度百分比
- **交互式查看**: 悬停查看静脉详情，点击查看完整信息
- **智能过滤**: 可调节置信度阈值筛选结果

### 🎨 现代化界面
- **VSCode风格**: 采用经典的深色主题设计
- **响应式布局**: 支持面板大小调整，最佳视觉体验
- **专业工具栏**: 功能按钮分组，操作便捷
- **状态指示**: 清晰的加载状态和错误提示
- **键盘支持**: 完整的快捷键操作体系

### 🔗 完整通信
- **RESTful API**: 标准化的后端接口通信
- **错误处理**: 完善的错误捕获和用户提示
- **状态管理**: 统一的状态管理机制
- **模拟数据**: 开发环境的完整模拟数据支持

## 🛠️ 技术栈

- **React 18.3**: 现代化前端框架
- **TypeScript 5.6**: 类型安全的开发体验
- **Vite 6.0**: 快速构建工具
- **Tailwind CSS**: 实用优先的样式框架
- **Lucide React**: 丰富的图标库
- **Canvas API**: 高性能图形渲染

## 🚀 快速开始

### 环境要求
- Node.js 18+
- pnpm (推荐) 或 npm

### 安装依赖
```bash
cd frontend/ultrasound-vein-detection
pnpm install
```

### 开发模式
```bash
pnpm dev
```

### 生产构建
```bash
pnpm build
```

### 预览构建
```bash
pnpm preview
```

## 📁 项目结构

```
src/
├── api/                    # API通信层
│   ├── types.ts           # 类型定义
│   └── client.ts          # API客户端
├── components/            # React组件
│   ├── VideoPlayer.tsx    # 视频播放器
│   ├── ROIEditor.tsx      # ROI编辑器
│   ├── VeinVisualization.tsx # 静脉可视化
│   ├── MainLayout.tsx     # 主布局
│   ├── LoadingSpinner.tsx # 加载指示器
│   └── ErrorBoundary.tsx  # 错误边界
├── hooks/                 # 自定义钩子
│   ├── useKeyboardShortcuts.ts # 键盘快捷键
│   └── useFileDrop.ts     # 文件拖拽
├── App.tsx               # 应用入口
├── App.css              # 应用样式
└── index.css            # 全局样式
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `空格` | 播放/暂停视频 |
| `←` | 上一帧 |
| `→` | 下一帧 |
| `Ctrl + R` | 清除ROI |
| `Ctrl + A` | 开始分析 |
| `Ctrl + V` | 显示/隐藏检测结果 |

## 🎯 使用指南

### 1. 上传视频
- 点击工具栏"上传视频"按钮
- 或直接拖拽视频文件到界面
- 支持 MP4, AVI, MOV 等格式

### 2. 设置ROI区域
- 在视频区域点击拖拽绘制矩形ROI
- 使用8个控制点调整ROI大小
- 拖拽ROI整体移动位置
- 蓝色框线实时显示当前选择区域

### 3. 开始检测分析
- 点击"开始分析"按钮
- 系统将自动分析ROI区域内的静脉
- 实时显示分析进度

### 4. 查看检测结果
- 右侧面板显示静脉检测结果
- 蓝色轮廓标记静脉位置
- 蓝色圆点标记静脉中心
- 悬停查看详细信息

### 5. 可视化设置
- 点击"设置"按钮打开配置面板
- 调节置信度阈值过滤结果
- 切换显示轮廓和中心点
- 自定义显示偏好

## 🎨 主题定制

项目采用CSS变量驱动的设计系统，可以轻松定制主题色彩：

```css
:root {
  --bg-primary: #1e1e1e;      /* 主背景色 */
  --bg-secondary: #2d2d30;    /* 次要背景色 */
  --text-primary: #cccccc;     /* 主文字色 */
  --accent-color: #0e639c;     /* 强调色 */
  /* 更多变量... */
}
```

## 🔧 配置选项

### 环境变量
```env
VITE_API_URL=http://localhost:8000/api
```

### API配置
在 `src/api/client.ts` 中可以配置：
- API基础URL
- 请求超时时间
- 错误处理策略
- 模拟数据开关

## 🐛 故障排除

### 常见问题

**Q: 视频无法播放**
- 检查视频文件格式是否支持
- 确认视频文件未损坏
- 检查浏览器媒体权限设置

**Q: ROI绘制无响应**
- 确保已正确上传视频
- 检查浏览器Canvas支持
- 清除浏览器缓存重试

**Q: API通信失败**
- 确认后端服务正在运行
- 检查网络连接状态
- 查看浏览器控制台错误信息

### 调试模式
开启开发工具查看详细错误信息：
```javascript
localStorage.setItem('debug', 'true');
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👥 团队

- **前端开发**: AI助手
- **UI/UX设计**: VSCode风格参考
- **技术支持**: 超声医学专家

## 📞 联系我们

如有问题或建议，请通过以下方式联系：
- 📧 Email: support@ultrasound-detection.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/ultrasound-detection/issues)
- 📖 文档: [在线文档](https://docs.ultrasound-detection.com)

---

⭐ 如果这个项目对您有帮助，请给我们一个星标！