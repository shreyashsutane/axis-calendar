-- Axis Bank Training Calendar & Management Database Schema (PostgreSQL)
-- Designed by Senior Database Architect
-- Designed to support high-performance real-time reporting and analytics

-- Enable UUID extension for scalable, merge-safe primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enums for strong data integrity
CREATE TYPE user_role AS ENUM ('employee', 'manager');
CREATE TYPE training_status AS ENUM ('scheduled', 'cancelled', 'rescheduled');
CREATE TYPE attendance_status AS ENUM ('pending', 'attended', 'absent', 'excused');

-- 1. Branches Table
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'AXIS0001'
    name VARCHAR(150) NOT NULL,              -- e.g., 'Mumbai Main Branch'
    city VARCHAR(100) NOT NULL,              -- e.g., 'Mumbai'
    latitude DOUBLE PRECISION,               -- GPS Latitude coordinate
    longitude DOUBLE PRECISION,              -- GPS Longitude coordinate
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Employees Table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'AXIS_9988'
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'employee',
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Trainings Table
CREATE TABLE trainings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    status training_status NOT NULL DEFAULT 'scheduled',
    training_type VARCHAR(10) NOT NULL DEFAULT 'online', -- 'online' or 'offline'
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    
    -- Rescheduling lineage & historical tracking
    rescheduled_from_id UUID REFERENCES trainings(id) ON DELETE SET NULL,
    original_start_time TIMESTAMP WITH TIME ZONE,
    cancelled_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Training Attendees Table (Many-to-Many Bridge)
CREATE TABLE training_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Attendance Status & Audit Info
    attendance_status attendance_status NOT NULL DEFAULT 'pending',
    marked_at TIMESTAMP WITH TIME ZONE,
    marked_by_id UUID REFERENCES employees(id) ON DELETE SET NULL, -- Audits if a manager manually marks
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure an employee is registered only once per training
    CONSTRAINT unique_training_employee UNIQUE (training_id, employee_id)
);

-- 5. Tasks Table (Multiple tasks can be associated with a Training)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Attendee Tasks Table (Tracks task assignments & completion per employee)
CREATE TABLE attendee_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Completion tracking
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure an attendee has exactly one record per task
    CONSTRAINT unique_task_employee UNIQUE (task_id, employee_id)
);

-- =========================================================================
-- INDEX OPTIMIZATIONS FOR REPORTING AND CALENDAR LOOKUPS
-- =========================================================================

-- Optimizes employee filtering by branch (essential for Manager attendee selection)
CREATE INDEX idx_employees_branch ON employees(branch_id);

-- Optimizes role-based access check / queries
CREATE INDEX idx_employees_role ON employees(role);

-- Optimizes Calendar View queries (filtering trainings by date range & status)
CREATE INDEX idx_trainings_schedule ON trainings(scheduled_start, scheduled_end);
CREATE INDEX idx_trainings_status ON trainings(status);
CREATE INDEX idx_trainings_manager ON trainings(manager_id);

-- Optimizes attendee retrieval and verification checks
CREATE INDEX idx_training_attendees_training ON training_attendees(training_id);
CREATE INDEX idx_training_attendees_employee ON training_attendees(employee_id);
CREATE INDEX idx_training_attendees_status ON training_attendees(attendance_status);

-- Optimizes task lists for trainings
CREATE INDEX idx_tasks_training ON tasks(training_id);

-- Optimizes attendee task tracking & completion rate calculations
CREATE INDEX idx_attendee_tasks_task ON attendee_tasks(task_id);
CREATE INDEX idx_attendee_tasks_employee ON attendee_tasks(employee_id);
CREATE INDEX idx_attendee_tasks_completed ON attendee_tasks(is_completed);


-- =========================================================================
-- AUTOMATED TRIGGER FUNCTIONS FOR UPDATED_AT TIMESTAMP
-- =========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER trg_update_branches BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_employees BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_trainings BEFORE UPDATE ON trainings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_training_attendees BEFORE UPDATE ON training_attendees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_tasks BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_update_attendee_tasks BEFORE UPDATE ON attendee_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
