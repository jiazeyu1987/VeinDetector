# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VeinDetector** is an advanced ultrasound vein detection and tracking system that processes medical ultrasound videos to automatically identify and track veins using computer vision and machine learning algorithms. The system provides a professional medical imaging platform with real-time processing capabilities.

## Architecture

The system uses a modern microservices architecture with three main layers:

### Frontend (React + TypeScript)
- **Location**: `frontend/ultrasound-vein-detection/`
- **Tech Stack**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Style**: VSCode-inspired dark theme with three-panel layout
- **Key Features**: Interactive ROI editing, real-time video processing, confidence visualization

### Backend (Python FastAPI)
- **Location**: `backend/`
- **Tech Stack**: FastAPI, OpenCV, PyTorch, SQLAlchemy
- **Core Engine**: Video processing pipeline with vein detection algorithms
- **API**: RESTful endpoints with auto-generated Swagger docs at `/docs`

### Infrastructure (Docker)
- **Development**: Multi-service setup (PostgreSQL, Redis, MinIO, API, Frontend)
- **Production**: Optimized containerized deployment
- **Services**: Database, cache, object storage, Jupyter notebook (port 8888)

## Development Commands

### Backend Development
```bash
cd backend

# Run development server (required virtual environment activation)
.\venv\Scripts\Activate.ps1  # PowerShell
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# OR
python main.py

# Testing and code quality
pytest --cov=.                           # Run tests with coverage
pytest tests/ -v                          # Run specific test files
black .                                   # Format code
flake8 .                                  # Lint code
mypy .                                    # Type checking
```

### Frontend Development
```bash
cd frontend/ultrasound-vein-detection
pnpm dev                                  # Development server (port 3000)
pnpm build                                # Production build
pnpm lint                                 # Code linting
pnpm preview                             # Preview build
```

### Docker Development
```bash
# Full development environment
docker-compose -f docker-compose.dev.yml up -d

# Production environment
docker-compose -f docker-compose.prod.yml up -d
```

## Core Processing Pipeline

The vein detection system follows this architecture:

```
Video Upload → Validation → Frame Extraction → Preprocessing →
Vein Detection → ROI Tracking → Result Storage → Visualization
```

### Key Backend Components

**Video Processing (`video_processor.py`)**:
- Handles video upload and validation (MP4, AVI, MOV, MKV)
- Extracts frames at 8 FPS for processing efficiency
- Applies image enhancement (Gaussian blur, CLAHE)
- Supports files up to 500MB

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
- `PUT /detection-settings` - Configure detection parameters
- `GET /download-results/{task_id}` - Export results as JSON

### Frontend Architecture

**Main Components**:
- `MainLayout.tsx` - VSCode-style interface with video player, controls, and results panel
- `VideoPlayer.tsx` - Custom video player with frame navigation and zoom
- `ROIEditor.tsx` - Interactive ROI drawing with 8-point control handles
- `VeinVisualization.tsx` - overlays detection results with confidence indicators

**Key Features**:
- Real-time processing with progress tracking
- Keyboard shortcuts (Ctrl+R, Ctrl+A, Ctrl+V)
- Color-coded confidence visualization (green: high, yellow: medium, red: low)
- Responsive design for different screen sizes

## Configuration

### Backend Configuration (`backend/config.yaml`)
- Video processing parameters (FPS, resolution limits)
- Detection algorithm thresholds (Canny, Hough transform)
- ROI tracking settings (size, movement thresholds)
- Performance limits (batch size, memory limits)

### Environment Variables
- Database connection (PostgreSQL)
- Cache configuration (Redis)
- Object storage (MinIO)
- API server settings

### Detection Settings
Default parameters are configurable via API:
- `canny_threshold_low`: 50 (edge detection lower bound)
- `canny_threshold_high`: 150 (edge detection upper bound)
- `min_vein_area`: 100 pixels (minimum vein size)
- `max_vein_area`: 2000 pixels (maximum vein size)

## Testing Infrastructure

**Test Types**:
- Unit tests for individual algorithms
- Integration tests for API endpoints
- End-to-end tests for complete workflows
- Performance tests for system validation

**Test Coverage**:
- Video upload and validation
- Vein detection accuracy
- ROI tracking reliability
- API response times
- Frontend UI interactions

## System Performance

**Processing Capabilities**:
- Video upload: < 5 seconds (100MB file)
- Vein detection: < 2 seconds per frame (1920x1080)
- API response: < 200ms (95th percentile)
- System startup: < 30 seconds

**Quality Assurance**:
- Automated code formatting (Black)
- Static analysis (Flake8, MyPy)
- Comprehensive test coverage
- Performance monitoring and alerting

## Key Design Patterns

**Asynchronous Processing**:
- Background task processing with FastAPI
- Real-time progress updates via WebSocket
- Non-blocking video processing pipeline

**Error Handling**:
- Comprehensive validation for video uploads
- Graceful degradation for detection failures
- User-friendly error messages and recovery options

**Scalability**:
- Containerized deployment with Docker
- Horizontal scaling support via task queues
- Configurable processing parameters for different hardware

## Development Notes

**Common Issues**:
- Virtual environment activation is required for backend development
- Unicode encoding issues may occur with Chinese comments - ensure UTF-8 encoding
- GPU acceleration available for production deployments
- Large video files may require increased memory limits

**Performance Optimization**:
- Frame extraction limited to 8 FPS for processing efficiency
- ROI tracking reduces processing area for better performance
- Configurable batch sizes for memory management
- Background processing prevents UI blocking

**Security Considerations**:
- File type validation for video uploads
- Size limits to prevent resource exhaustion
- Sanitized API responses
- No sensitive data in configuration files