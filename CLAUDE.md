# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VeinDetector** is an advanced ultrasound vein detection and tracking system that processes medical ultrasound videos to automatically identify and track veins using computer vision and machine learning algorithms. The system provides a professional medical imaging platform with real-time processing capabilities and deep learning model integration.

## Architecture

The system uses a modern microservices architecture with three main layers:

### Frontend (React + TypeScript)
- **Location**: `frontend/ultrasound-vein-detection/`
- **Tech Stack**: React 18.3, TypeScript 5.6, Vite 6.0, Tailwind CSS v3.4
- **UI Library**: Radix UI components (65+ components)
- **UI Style**: VSCode-inspired dark theme with three-panel layout
- **Key Features**: Interactive ROI editing, real-time video processing, confidence visualization

### Backend (Python FastAPI + ML)
- **Location**: `backend/`
- **Core Framework**: FastAPI 0.104.1, Uvicorn 0.24.0
- **Computer Vision**: OpenCV 4.8.1.78, FFmpeg 0.2.0, Pillow 10.1.0
- **Machine Learning**: PyTorch 2.1.1, TorchVision 0.16.1, Scikit-learn 1.3.2
- **Image Processing**: Albumentations 1.3.1, Scikit-image 0.21.0, Segmentation-models-pytorch 0.3.3
- **Performance**: Numba 0.58.1 for optimization
- **API**: RESTful endpoints with auto-generated Swagger docs at `/docs`

### Infrastructure (Docker + Monitoring)
- **Development**: 8 services (PostgreSQL, Redis, MinIO, API, Frontend, Video-service, Jupyter, MailHog)
- **Production**: 16 services with monitoring stack (Prometheus, Grafana, Elasticsearch, Kibana)
- **Background Tasks**: Celery workers with Redis broker
- **Services**: Database (5432), Redis (6379), MinIO (9000), API (8000), Web (3000), Jupyter (8888), MailHog (8025)

## Development Commands

### Backend Development
```bash
cd backend

# Quick start with provided script
chmod +x start.sh && ./start.sh

# Manual setup
python3 -m venv venv
.\venv\Scripts\Activate.ps1  # PowerShell
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# OR
python main.py

# Testing and code quality
pytest test_system.py -v                 # Run system tests
pytest --cov=.                           # Run tests with coverage
black .                                   # Format code
flake8 .                                  # Lint code
mypy .                                    # Type checking
isort .                                   # Sort imports

# Production deployment
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend Development
```bash
cd frontend/ultrasound-vein-detection

# Development
pnpm install --prefer-offline && pnpm dev # Development server (port 3000)

# Build and quality
pnpm build                                # Production build
pnpm build:prod                           # Production build with optimizations
pnpm lint                                 # Code linting
pnpm preview                             # Preview build
pnpm clean                                # Clean dependencies and cache
```

### Docker Development
```bash
# Full development environment (8 services)
docker-compose -f docker-compose.dev.yml up -d

# Production environment (16 services with monitoring)
docker-compose -f docker-compose.prod.yml up -d

# Backend-only container
cd backend && docker-compose up -d

# Service logs
docker-compose logs -f [service-name]
docker-compose ps                         # Check service status
```

## Machine Learning Integration

### SAMUS Inference System (`samus_inference.py`)

The system now includes advanced ML model support with multiple segmentation approaches:

**Model Support**:
- **SAMUS**: Advanced vein segmentation model
- **U-Net**: Medical image segmentation
- **nnU-Net**: Automated medical segmentation
- **CV Models**: Traditional computer vision approaches

**Available Algorithms**:
- `CVVeinSegmentor`: Standard CV approach with Canny + Hough
- `EnhancedCVVeinSegmentor`: Enhanced CV with Frangi filters
- `SamusVeinSegmentor`: Deep learning-based segmentation

**Key API Endpoints**:
- `POST /analysis/samus` - Real-time vein segmentation from canvas data URLs
- Support for model selection via request parameters
- Multiple algorithm fallback system

## Core Processing Pipeline

The vein detection system follows this architecture:

```
Video Upload → Validation → Frame Extraction → Preprocessing →
ML Model Inference → Vein Detection → ROI Tracking → Result Storage → Visualization
```

### Key Backend Components

**Video Processing (`video_processor.py`)**:
- Handles video upload and validation (MP4, AVI, MOV, MKV)
- Extracts frames at 8 FPS for processing efficiency
- Applies image enhancement (Gaussian blur, CLAHE)
- Supports files up to 500MB

**ML Inference (`samus_inference.py`)**:
- Real-time vein segmentation using deep learning models
- Canvas-based image processing from data URLs
- Model routing and algorithm selection
- Performance optimization with Numba

**Vein Detection (`vein_detector.py`)**:
- Multi-algorithm approach: Canny edge detection + Hough circles + ellipse fitting
- Connected component analysis for vein segmentation
- Confidence scoring system (0-1 range)
- Configurable detection parameters

**ROI Tracking (`roi_handler.py`)**:
- Interactive Region of Interest management
- Dynamic ROI updates based on vein positions
- Movement smoothing to prevent jittery tracking
- Historical tracking with configurable parameters

**API Endpoints (`main.py`)**:
- `POST /upload-video` - Upload and start processing
- `GET /processing-status/{task_id}` - Real-time progress monitoring
- `GET /detection-results/{task_id}` - Retrieve detection results
- `POST /analysis/samus` - Real-time vein segmentation analysis
- `PUT /detection-settings` - Configure detection parameters
- `GET /download-results/{task_id}` - Export results as JSON

### Frontend Architecture

**Main Components**:
- `MainLayout.tsx` (462 lines) - VSCode-style interface with video player, controls, and results panel
- `VideoPlayer.tsx` (276 lines) - Custom video player with frame navigation, zoom, and playback controls
- `ROIEditor.tsx` (419 lines) - Interactive ROI drawing with 8-point control handles
- `VeinVisualization.tsx` (433 lines) - overlays detection results with confidence indicators
- `api/client.ts` - Complete RESTful API client with mock data support
- `api/types.ts` - Comprehensive TypeScript type definitions

**Supporting Components**:
- `ErrorBoundary.tsx` - Error boundary with graceful fallback
- `LoadingSpinner.tsx` - Loading state indicators
- `useKeyboardShortcuts.ts` - Keyboard shortcuts hook (Space, arrows, Ctrl+R/A/V)
- `useFileDrop.ts` - File drag-and-drop functionality

**Key Features**:
- Real-time processing with progress tracking
- Professional keyboard shortcuts (Space, ←/→, Ctrl+R, Ctrl+A, Ctrl+V)
- Color-coded confidence visualization (green: high, yellow: medium, red: low)
- Responsive design for different screen sizes
- Mock data support for development without backend

## Configuration

### Environment Variables
**Frontend**:
```bash
VITE_API_BASE_URL=http://localhost:8000      # Backend API URL
NODE_ENV=development/production              # Environment mode
```

**Backend**:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/vein_db
REDIS_URL=redis://localhost:6379
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=password
SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
```

**Production**:
```bash
DB_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_USER
CORS_ORIGINS, API_WORKERS, DETECTION_BATCH_SIZE
```

### Backend Configuration (`backend/config.yaml`)
- Video processing parameters (FPS, resolution limits)
- Detection algorithm thresholds (Canny, Hough transform)
- ROI tracking settings (size, movement thresholds)
- Performance limits (batch size, memory limits)

### Detection Settings
Default parameters are configurable via API:
- `canny_threshold_low`: 50 (edge detection lower bound)
- `canny_threshold_high`: 150 (edge detection upper bound)
- `min_vein_area`: 100 pixels (minimum vein size)
- `max_vein_area`: 2000 pixels (maximum vein size)
- Model selection: SAMUS, U-Net, CV models

## Testing Infrastructure

**Current Test Setup**:
- `backend/test_system.py` - System integration tests
- Manual testing via API endpoints
- Video processing validation
- ML model inference validation

**Test Coverage Areas**:
- Video upload and validation
- Vein detection accuracy across algorithms
- ROI tracking reliability
- API response times and error handling
- ML model performance and fallback systems
- Frontend UI interactions with mock data

**Quality Assurance Tools**:
- Automated code formatting (Black, isort)
- Static analysis (Flake8, MyPy)
- ESLint for frontend code
- Performance monitoring and alerting

## Production Infrastructure

### Monitoring Stack
- **Prometheus**: Metrics collection and monitoring
- **Grafana**: Dashboard visualization and alerts
- **Elasticsearch**: Log aggregation and search
- **Kibana**: Log analysis and visualization
- **Filebeat**: Log shipping from containers

### Background Processing
- **Celery Workers**: Distributed task processing
- **Redis Broker**: Message queuing and distribution
- **Beat Scheduler**: Periodic task management

### Resource Management
- **Nginx**: Reverse proxy with SSL termination
- **MinIO**: Object storage for video files
- **Docker Resource Limits**: CPU/memory constraints
- **Health Checks**: Automated service monitoring

## System Performance

**Processing Capabilities**:
- Video upload: < 5 seconds (100MB file)
- Vein detection: < 2 seconds per frame (1920x1080)
- ML inference: < 1 second per frame with GPU acceleration
- API response: < 200ms (95th percentile)
- System startup: < 30 seconds

**Quality Assurance**:
- Automated code formatting (Black)
- Static analysis (Flake8, MyPy)
- Comprehensive test coverage
- Performance monitoring and alerting

## Key Design Patterns

**Asynchronous Processing**:
- Background task processing with FastAPI and Celery
- Real-time progress updates via WebSocket
- Non-blocking video processing pipeline

**ML Model Integration**:
- Multiple algorithm fallback system
- Model routing based on image characteristics
- Performance optimization with Numba JIT compilation

**Error Handling**:
- Comprehensive validation for video uploads
- Graceful degradation for detection failures
- User-friendly error messages and recovery options
- Unicode handling for Chinese comments (UTF-8)

**Scalability**:
- Containerized deployment with Docker
- Horizontal scaling support via Celery workers
- Configurable processing parameters for different hardware
- Load balancing with Nginx

## Development Notes

**Common Issues**:
- Virtual environment activation is required for backend development
- Use UTF-8 encoding for files with Chinese comments
- GPU acceleration available for production deployments
- Large video files may require increased memory limits

**Performance Optimization**:
- Frame extraction limited to 8 FPS for processing efficiency
- ROI tracking reduces processing area for better performance
- Configurable batch sizes for memory management
- Background processing prevents UI blocking
- Numba JIT compilation for critical algorithm sections

**Security Considerations**:
- File type validation for video uploads
- Size limits to prevent resource exhaustion
- Sanitized API responses
- No sensitive data in configuration files
- CORS configuration for cross-origin requests

## Documentation References

- **Root README.md**: Comprehensive testing framework and integration documentation
- **backend/README.md**: Detailed API documentation and deployment guide
- **backend/DEPLOYMENT.md**: Production deployment instructions
- **frontend/ultrasound-vein-detection/PROJECT_SUMMARY.md**: Frontend completion report
- **API Documentation**: Available at `http://localhost:8000/docs` (Swagger UI)