-- 静脉检测系统数据库初始化脚本

-- 创建必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 创建自定义类型
CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'operator', 'viewer');
CREATE TYPE video_status AS ENUM ('uploaded', 'processing', 'completed', 'failed', 'archived');
CREATE TYPE detection_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE roi_type AS ENUM ('vein_region', 'reference_point', 'exclusion_area');

-- 创建序列
CREATE SEQUENCE IF NOT EXISTS users_id_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS videos_id_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS detection_results_id_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS roi_annotations_id_seq START 1000;

-- 创建函数：更新时间戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建函数：生成UUID
CREATE OR REPLACE FUNCTION generate_video_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'video_' || to_char(NOW(), 'YYYYMMDD') || '_' || lpad(nextval('videos_id_seq')::text, 3, '0');
END;
$$ language 'plpgsql';

-- 创建函数：搜索向量更新
CREATE OR REPLACE FUNCTION update_vein_detection_vector()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新搜索向量（用于全文搜索）
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.description, '') || ' ' || 
        COALESCE(NEW.patient_id, '') || ' ' ||
        COALESCE(NEW.video_metadata::text, '')
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建主表

-- 用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role user_role DEFAULT 'viewer',
    department VARCHAR(50),
    license_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 患者信息表
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    age INTEGER,
    gender VARCHAR(10),
    date_of_birth DATE,
    medical_history TEXT,
    contact_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 视频表
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(30) UNIQUE DEFAULT generate_video_id(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_size BIGINT,
    file_path TEXT NOT NULL,
    storage_url TEXT,
    duration DECIMAL(10,2),
    fps DECIMAL(5,2),
    resolution VARCHAR(20),
    codec VARCHAR(50),
    patient_id VARCHAR(20),
    uploaded_by INTEGER REFERENCES users(id),
    patient_info_id INTEGER REFERENCES patients(id),
    status video_status DEFAULT 'uploaded',
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_start_time TIMESTAMP,
    processing_end_time TIMESTAMP,
    description TEXT,
    video_metadata JSONB,
    search_vector tsvector,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 视频帧表
CREATE TABLE video_frames (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(30) REFERENCES videos(video_id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    timestamp DECIMAL(10,3),
    frame_path TEXT NOT NULL,
    frame_url TEXT,
    width INTEGER,
    height INTEGER,
    file_size BIGINT,
    quality_score DECIMAL(3,2),
    is_key_frame BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 静脉检测任务表
CREATE TABLE detection_tasks (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) UNIQUE NOT NULL,
    video_id VARCHAR(30) REFERENCES videos(video_id) ON DELETE CASCADE,
    frame_numbers INTEGER[],
    algorithm VARCHAR(20) DEFAULT 'advanced',
    parameters JSONB,
    status detection_status DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    total_frames INTEGER,
    processed_frames INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 静脉检测结果表
CREATE TABLE detection_results (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) REFERENCES detection_tasks(task_id) ON DELETE CASCADE,
    video_id VARCHAR(30) REFERENCES videos(video_id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    vein_points JSONB,
    vein_paths JSONB,
    confidence_scores JSONB,
    analysis_metrics JSONB,
    annotated_image_path TEXT,
    annotated_image_url TEXT,
    processing_time DECIMAL(8,3),
    algorithm_version VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ROI标注表
CREATE TABLE roi_annotations (
    id SERIAL PRIMARY KEY,
    roi_id VARCHAR(50) NOT NULL,
    video_id VARCHAR(30) REFERENCES videos(video_id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    roi_type roi_type NOT NULL,
    coordinates JSONB NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 5,
    properties JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ROI历史表
CREATE TABLE roi_history (
    id SERIAL PRIMARY KEY,
    roi_id VARCHAR(50) NOT NULL,
    video_id VARCHAR(30) REFERENCES videos(video_id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL, -- created, updated, deleted, moved
    old_values JSONB,
    new_values JSONB,
    changed_by INTEGER REFERENCES users(id),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统配置表
CREATE TABLE system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_editable BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 审计日志表
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引

-- 用户表索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- 患者表索引
CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patients_name ON patients(name);

-- 视频表索引
CREATE INDEX idx_videos_video_id ON videos(video_id);
CREATE INDEX idx_videos_patient_id ON videos(patient_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_upload_time ON videos(upload_time);
CREATE INDEX idx_videos_uploaded_by ON videos(uploaded_by);
CREATE INDEX idx_videos_patient_info_id ON videos(patient_info_id);
CREATE INDEX idx_videos_search_vector ON videos USING gin(search_vector);

-- 视频帧表索引
CREATE INDEX idx_video_frames_video_id ON video_frames(video_id);
CREATE INDEX idx_video_frames_frame_number ON video_frames(frame_number);
CREATE INDEX idx_video_frames_video_frame ON video_frames(video_id, frame_number);

-- 检测任务表索引
CREATE INDEX idx_detection_tasks_task_id ON detection_tasks(task_id);
CREATE INDEX idx_detection_tasks_video_id ON detection_tasks(video_id);
CREATE INDEX idx_detection_tasks_status ON detection_tasks(status);
CREATE INDEX idx_detection_tasks_created_by ON detection_tasks(created_by);
CREATE INDEX idx_detection_tasks_created_at ON detection_tasks(created_at);

-- 检测结果表索引
CREATE INDEX idx_detection_results_task_id ON detection_results(task_id);
CREATE INDEX idx_detection_results_video_id ON detection_results(video_id);
CREATE INDEX idx_detection_results_frame_number ON detection_results(frame_number);
CREATE INDEX idx_detection_results_video_frame ON detection_results(video_id, frame_number);

-- ROI标注表索引
CREATE INDEX idx_roi_annotations_roi_id ON roi_annotations(roi_id);
CREATE INDEX idx_roi_annotations_video_id ON roi_annotations(video_id);
CREATE INDEX idx_roi_annotations_frame_number ON roi_annotations(frame_number);
CREATE INDEX idx_roi_annotations_video_frame ON roi_annotations(video_id, frame_number);
CREATE INDEX idx_roi_annotations_roi_type ON roi_annotations(roi_type);
CREATE INDEX idx_roi_annotations_is_active ON roi_annotations(is_active);

-- ROI历史表索引
CREATE INDEX idx_roi_history_roi_id ON roi_history(roi_id);
CREATE INDEX idx_roi_history_video_id ON roi_history(video_id);
CREATE INDEX idx_roi_history_created_at ON roi_history(created_at);

-- 系统配置表索引
CREATE INDEX idx_system_config_config_key ON system_config(config_key);

-- 审计日志表索引
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 创建触发器

-- 更新时间戳触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_detection_tasks_updated_at BEFORE UPDATE ON detection_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roi_annotations_updated_at BEFORE UPDATE ON roi_annotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 搜索向量更新触发器
CREATE TRIGGER update_videos_search_vector BEFORE INSERT OR UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_vein_detection_vector();

-- ROI历史记录触发器
CREATE OR REPLACE FUNCTION record_roi_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO roi_history (roi_id, video_id, frame_number, action, new_values, changed_by)
        VALUES (NEW.roi_id, NEW.video_id, NEW.frame_number, 'created', to_jsonb(NEW), NEW.created_by);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO roi_history (roi_id, video_id, frame_number, action, old_values, new_values, changed_by)
        VALUES (NEW.roi_id, NEW.video_id, NEW.frame_number, 'updated', to_jsonb(OLD), to_jsonb(NEW), NEW.created_by);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO roi_history (roi_id, video_id, frame_number, action, old_values, changed_by)
        VALUES (OLD.roi_id, OLD.video_id, OLD.frame_number, 'deleted', to_jsonb(OLD), OLD.created_by);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER record_roi_changes AFTER INSERT OR UPDATE OR DELETE ON roi_annotations
FOR EACH ROW EXECUTE FUNCTION record_roi_change();

-- 插入初始数据

-- 创建默认管理员用户
INSERT INTO users (username, email, password_hash, full_name, role) VALUES
('admin', 'admin@vein-detection.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPjJ0w5v1L2v2', 'System Administrator', 'admin');

-- 创建默认系统配置
INSERT INTO system_config (config_key, config_value, description) VALUES
('video_upload', '{"max_file_size": 524288000, "allowed_formats": ["mp4", "avi", "mov", "mkv"], "max_duration": 300}', '视频上传配置'),
('detection', '{"default_algorithm": "advanced", "batch_size": 8, "max_concurrent_tasks": 10}', '检测引擎配置'),
('storage', '{"retention_days": 365, "auto_cleanup": true, "backup_enabled": true}', '存储配置'),
('ui', '{"default_language": "zh-CN", "theme": "light", "pagination_size": 20}', '界面配置');

-- 初始化视图

-- 视频概览视图
CREATE VIEW video_overview AS
SELECT 
    v.video_id,
    v.filename,
    v.patient_id,
    v.duration,
    v.fps,
    v.resolution,
    v.status,
    v.upload_time,
    u.full_name as uploaded_by_name,
    COUNT(DISTINCT vf.id) as total_frames,
    COUNT(DISTINCT dr.id) as detection_results_count,
    COUNT(DISTINCT ra.id) as roi_count
FROM videos v
LEFT JOIN users u ON v.uploaded_by = u.id
LEFT JOIN video_frames vf ON v.video_id = vf.video_id
LEFT JOIN detection_results dr ON v.video_id = dr.video_id
LEFT JOIN roi_annotations ra ON v.video_id = ra.video_id AND ra.is_active = true
GROUP BY v.video_id, v.filename, v.patient_id, v.duration, v.fps, v.resolution, v.status, v.upload_time, u.full_name;

-- 检测任务概览视图
CREATE VIEW detection_task_overview AS
SELECT 
    dt.task_id,
    dt.video_id,
    v.filename,
    dt.algorithm,
    dt.status,
    dt.total_frames,
    dt.processed_frames,
    dt.started_at,
    dt.completed_at,
    u.full_name as created_by_name,
    ROUND((dt.processed_frames::decimal / NULLIF(dt.total_frames, 0)) * 100, 2) as progress_percentage
FROM detection_tasks dt
JOIN videos v ON dt.video_id = v.video_id
LEFT JOIN users u ON dt.created_by = u.id;

-- 权限函数

-- 检查用户权限函数
CREATE OR REPLACE FUNCTION check_user_permission(user_role user_role, required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
    -- 管理员拥有所有权限
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- 其他角色权限检查
    CASE required_role
        WHEN 'admin' THEN RETURN false;
        WHEN 'doctor' THEN RETURN user_role IN ('doctor', 'admin');
        WHEN 'operator' THEN RETURN user_role IN ('operator', 'doctor', 'admin');
        WHEN 'viewer' THEN RETURN user_role IN ('viewer', 'operator', 'doctor', 'admin');
        ELSE RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 数据完整性约束
ALTER TABLE videos ADD CONSTRAINT videos_duration_positive CHECK (duration > 0);
ALTER TABLE videos ADD CONSTRAINT videos_fps_positive CHECK (fps > 0);
ALTER TABLE videos ADD CONSTRAINT videos_file_size_positive CHECK (file_size > 0);

ALTER TABLE video_frames ADD CONSTRAINT video_frames_dimension_positive CHECK (width > 0 AND height > 0);
ALTER TABLE video_frames ADD CONSTRAINT video_frames_frame_number_positive CHECK (frame_number >= 0);

ALTER TABLE detection_results ADD CONSTRAINT detection_results_frame_number_positive CHECK (frame_number >= 0);

ALTER TABLE roi_annotations ADD CONSTRAINT roi_annotations_priority_check CHECK (priority >= 1 AND priority <= 10);

-- 完成初始化
SELECT 'Database initialization completed successfully!' as status;