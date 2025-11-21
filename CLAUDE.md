# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VeinDetector** is an advanced medical imaging system for ultrasound vein detection and tracking. The system processes medical ultrasound videos using computer vision and machine learning algorithms to automatically identify and track veins in real-time.

## Architecture Overview

The system uses a modern microservices architecture with comprehensive testing infrastructure:

### Frontend (React + TypeScript)
- **Location**: `frontend/ultrasound-vein-detection/`
- **Tech Stack**: React 18.3, TypeScript 5.6, Vite 6.0, Tailwind CSS v3.4, Radix UI
- **Key Features**: Interactive ROI editing, real-time video processing, confidence visualization, VSCode-inspired dark theme

### Backend (Python FastAPI + ML)
- **Location**: `backend/` (Python files at root level, no src/ directory)
- **Core Framework**: FastAPI with comprehensive ML stack
- **Computer Vision**: OpenCV, FFmpeg, Pillow
- **Machine Learning**: PyTorch, TorchVision, Scikit-learn, segmentation-models-pytorch
- **Performance**: Numba JIT compilation for algorithm optimization

### Infrastructure
- **Development**: 8 services (PostgreSQL, Redis, MinIO, API, Frontend, Video-service, Jupyter, MailHog)
- **Production**: 16 services with monitoring stack (Prometheus, Grafana, Elasticsearch, Kibana)

## Development Commands

### Root Level Commands (Primary Development Workflow)
```bash
# Development workflow
npm run dev                    # Start frontend development server
npm run build                  # Build both frontend and backend
npm run test                   # Run Jest test suite
npm run lint                   # ESLint checking
npm run health-check           # API health check

# Comprehensive testing
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests
npm run test:e2e              # End-to-end tests
npm run test:performance      # Performance tests
npm run test:memory           # Memory usage analysis
npm run test:cpu              # CPU usage analysis
npm run test:coverage         # Test coverage report

# Docker management
npm run docker:build           # Build Docker images
npm run docker:up             # Start Docker containers
npm run docker:down           # Stop Docker containers
npm run docker:logs           # View Docker logs

# Dependencies
npm run install:all            # Install all dependencies (root, frontend, backend, video-service)
npm run clean                  # Clean all node_modules

# Deployment and monitoring
npm run deploy                 # Production deployment via scripts/deploy.sh
npm run monitor                # System monitoring via scripts/monitor.js
```

### Frontend Development
```bash
cd frontend/ultrasound-vein-detection

# Development server (recommended approach)
pnpm install --prefer-offline && pnpm dev    # Development with auto-reload (port 3000)

# Build and quality
pnpm build                                  # Production build
pnpm build:prod                             # Production build with optimizations
pnpm lint                                   # ESLint code checking
pnpm preview                               # Preview production build
pnpm clean                                  # Clean dependencies and cache
```

### Backend Development
```bash
cd backend

# Quick start (recommended)
./start.sh                                  # Quick start script (sets up venv, installs deps, starts server)

# Manual development server
python main.py                              # Run FastAPI application directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload  # With hot reload

# Testing and code quality
python test_system.py -v                    # Run system tests
pytest --cov=.                             # Run tests with coverage
black .                                     # Format code
flake8 .                                    # Lint code
mypy .                                      # Type checking
isort .                                     # Sort imports
```

### Docker Development
```bash
# Development environment (8 services: postgres, redis, minio, api, web, video-service, mailhog, jupyter)
docker-compose -f docker-compose.dev.yml up -d      # Start all services
docker-compose -f docker-compose.dev.yml down       # Stop all services
docker-compose -f docker-compose.dev.yml logs -f    # View logs

# Production environment (16 services with monitoring)
docker-compose -f docker-compose.prod.yml up -d     # Start production stack
```

### Development Scripts (Recommended for Automation)
```bash
# Service management (automates environment setup and health checks)
./scripts/dev-start.sh                   # Start all 8 development services
./scripts/dev-stop.sh                    # Stop all development services
./scripts/dev-restart.sh                 # Restart all services
./scripts/dev-logs.sh                    # View logs from all services

# Production deployment
./scripts/deploy.sh check                # Check system environment and dependencies
./scripts/deploy.sh deploy               # Full deployment workflow
./scripts/deploy.sh start                # Start services
./scripts/deploy.sh monitor              # Monitor system health with live dashboard
./scripts/deploy.sh logs [service]       # View service logs
./scripts/deploy.sh backup               # Backup data (database, uploads, config)
./scripts/deploy.sh cleanup              # Clean system resources
./scripts/deploy.sh test                 # Run performance tests
```

## Core Backend Components

### ML Model Integration (`samus_inference.py`, `model_loader.py`)
- **Deep Learning Models**: SAMUS (Segment Anything Model for Ultrasound), U-Net, nnU-Net via segmentation-models-pytorch
- **Traditional CV Algorithms**: CVVeinSegmentor, EnhancedCVVeinSegmentor (with Frangi filters), SimpleCenterCVVeinSegmentor, EllipticalMorphSegmentor
- **Key Features**: Real-time canvas-based processing, intelligent model routing, Numba JIT optimization for performance-critical sections
- **Environment Compatibility**: Handles transformers/torch compatibility issues with safe pytree wrappers

### Video Processing Pipeline (`video_processor.py`, `vein_detector.py`, `roi_handler.py`)
- **Video Support**: MP4, AVI, MOV, MKV (up to 500MB files)
- **Processing Pipeline**: Frame extraction at 8 FPS, Gaussian blur preprocessing, CLAHE enhancement
- **Detection Algorithms**: Canny edge detection + Hough circles + ellipse fitting for vein identification
- **ROI Tracking**: Interactive management with Kalman filtering for smooth movement tracking
- **Performance**: Async background processing with progress monitoring

### API Endpoints (`main.py`)
- `POST /upload-video` - Upload and start video processing with file validation
- `GET /processing-status/{task_id}` - Real-time progress monitoring with ETA calculations
- `GET /detection-results/{task_id}` - Retrieve comprehensive detection results with vein regions
- `POST /analysis/samus` - Real-time vein segmentation analysis with multiple algorithm support
- `PUT /detection-settings` - Configure detection parameters dynamically during processing
- `GET /download-results/{task_id}` - Export results as JSON with complete metadata
- `GET /health` - System health check for all components
- `DELETE /tasks/{task_id}` - Clean up completed tasks and resources

## Frontend Architecture

### Main Components
- `MainLayout.tsx` - VSCode-inspired interface with video player, controls panel, and results visualization
- `VideoPlayer.tsx` - Custom HTML5 video player with frame navigation, zoom controls, and variable playback speed
- `ROIEditor.tsx` - Interactive ROI drawing with 8-point control handles for precise region selection
- `VeinVisualization.tsx` - Real-time overlay of detection results with confidence-based color coding
- `api/client.ts` - Complete RESTful API client with fallback mock data support for offline development

### Algorithm Parameter Controls
The system supports real-time parameter adjustment for multiple vein detection algorithms:
- **Enhanced CV Parameters**: Frangi filter settings, morphological operations, aspect ratio constraints
- **Simple Center Parameters**: Basic morphological processing with circularity filtering
- **Elliptical Morph Parameters**: Threshold-based segmentation with ellipse fitting (T1 slider)

### Key Features
- Professional keyboard shortcuts (Space for play/pause, ←/→ for frame navigation, Ctrl+R for reset, Ctrl+A/V for ROI management)
- Color-coded confidence visualization (green: high confidence, yellow: medium, red: low confidence)
- Real-time algorithm parameter adjustment with immediate visual feedback
- Canvas-based image processing with grayscale conversion and data URL handling
- VSCode-style dark theme UI with responsive layout

## Configuration Files

### Backend Configuration
- `backend/config.yaml` - Main system configuration (video processing settings, detection thresholds, ROI parameters)
- `backend/detection_config.yaml` - Algorithm-specific configuration (model selection, deep learning hyperparameters, image processing pipelines)
- `backend/requirements.txt` - Comprehensive Python dependencies with specific versions

### Environment Variables
```bash
# Frontend
VITE_API_BASE_URL=http://localhost:8000      # Backend API URL
NODE_ENV=development/production              # Environment mode

# Backend
DATABASE_URL=postgresql://user:pass@localhost:5432/vein_db
REDIS_URL=redis://localhost:6379
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=password
SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
```

## Testing Infrastructure

### Comprehensive Test Framework
- **Unit Tests**: `tests/unit/` - Individual component testing (videoUpload.test.js, veinDetection.test.js)
- **Integration Tests**: `tests/integration/` - Cross-component integration testing (systemIntegration.test.js)
- **E2E Tests**: `tests/e2e/` - Full application flow testing (e2e-test-runner.js)
- **Performance Tests**: `tests/performance/` - Load and stress testing (performanceOptimization.test.js)

### Test Execution Commands
```bash
# Root level test commands
npm test                                    # Run all tests with Jest
npm run test:unit                          # Unit tests only
npm run test:integration                   # Integration tests only
npm run test:e2e                          # End-to-end tests with Puppeteer
npm run test:performance                  # Performance tests with load testing
npm run test:coverage                     # Generate coverage report
npm run test:benchmark                    # Performance benchmark comparison

# Backend specific
cd backend && python test_system.py -v    # System integration tests
cd backend && pytest --cov=.             # Test coverage analysis

# Performance analysis
npm run test:memory                       # Memory usage profiling
npm run test:cpu                          # CPU usage analysis
```

## System Monitoring and Health Checks

### Monitoring Scripts
- `scripts/monitor.js` - Real-time system monitoring with CPU, memory, disk usage tracking
- `scripts/errorHandler.js` - Comprehensive error handling with severity-based alerting
- Automated health checks for Frontend (port 3000), Backend (port 8000), Video service (port 8080), Database (port 5432)

### Performance Benchmarks
- **Video upload**: < 5 seconds for 100MB files
- **Vein detection**: < 2 seconds per frame for 1920x1080 resolution
- **ML inference**: < 1 second per frame with GPU acceleration
- **API response**: < 200ms (95th percentile)
- **System startup**: < 30 seconds for full stack
- **Memory usage**: < 2GB for typical workloads

## Key Development Notes

### Architecture Patterns
- **Mixed Package Management**: Root uses npm, frontend uses pnpm for optimal dependency resolution
- **Backend Structure**: Python files are at root level (no src/ directory), following FastAPI conventions
- **Frontend Nesting**: React application is located in `frontend/ultrasound-vein-detection/`
- **Shell Script Automation**: Heavy reliance on shell scripts for development and deployment workflows

### Core Technical Patterns
- **Canvas-Based Processing**: Real-time image processing using HTML5 Canvas API with data URL conversion
- **Multi-Algorithm Fallback**: Intelligent routing between deep learning models (SAMUS, U-Net) and traditional CV approaches
- **Async Background Processing**: FastAPI with asyncio for non-blocking video processing
- **Error Handling**: Comprehensive error management with severity-based logging and user feedback
- **Performance Optimization**: Numba JIT compilation for critical algorithm sections, especially morphological operations

### Development Environment Setup
- **Backend Quick Start**: `./start.sh` script handles virtual environment creation, dependency installation, and server startup
- **Frontend Development**: pnpm with Vite for fast hot-reload development experience
- **Docker Development**: 8-service stack with live-reload volumes for both frontend and backend
- **Health Monitoring**: Built-in health checks and monitoring scripts for all services

### Security and Production Considerations
- **File Validation**: Strict video file type and size validation (500MB limit)
- **Hardware Adaptability**: Configurable processing parameters for different hardware capabilities
- **CORS Configuration**: Proper cross-origin request handling for development and production
- **Configuration Security**: No sensitive credentials in version control (environment variables required)
- **Resource Management**: Automated memory cleanup and garbage collection for long-running processes

## Documentation References
- **API Documentation**: Available at `http://localhost:8000/docs` (Swagger UI) when backend is running
- **Development Scripts**: Comprehensive usage in `scripts/deploy.sh help` and `scripts/dev-*.sh`
- **Backend Deployment**: Detailed instructions in `backend/DEPLOYMENT.md`
- **Frontend Documentation**: Complete project documentation in `frontend/ultrasound-vein-detection/PROJECT_SUMMARY.md`