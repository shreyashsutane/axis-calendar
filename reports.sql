-- Axis Bank Training Calendar & Management Reports (SQL Queries)
-- Designed by Senior Database Architect
-- Designed to power the manager's Reports & Analytics dashboard

-- =========================================================================
-- REPORT 1: Total trainings scheduled by Year, Month, Day
-- =========================================================================
-- This query rolls up training statistics by scheduled date intervals
-- and breaks them down by status (Scheduled, Cancelled, Rescheduled).

SELECT 
    EXTRACT(YEAR FROM scheduled_start) AS training_year,
    EXTRACT(MONTH FROM scheduled_start) AS training_month,
    EXTRACT(DAY FROM scheduled_start) AS training_day,
    COUNT(*) AS total_trainings,
    COUNT(CASE WHEN status = 'scheduled' THEN 1 END) AS scheduled_count,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_count,
    COUNT(CASE WHEN status = 'rescheduled' THEN 1 END) AS rescheduled_count
FROM trainings
GROUP BY 
    EXTRACT(YEAR FROM scheduled_start),
    EXTRACT(MONTH FROM scheduled_start),
    EXTRACT(DAY FROM scheduled_start)
ORDER BY 
    training_year DESC, 
    training_month DESC, 
    training_day DESC;


-- =========================================================================
-- REPORT 2: Attendance Metrics (Attended vs Absent vs Cancelled)
-- =========================================================================
-- Query 2A: Global attendance metrics summary (useful for high-level charts)
SELECT 
    attendance_status,
    COUNT(*) AS total_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM training_attendees
GROUP BY attendance_status;

-- Query 2B: Granular attendance metrics per training session
-- Note: 'excused' represents instances where the employee had a valid cancellation/conflict
SELECT 
    t.id AS training_id,
    t.title AS training_title,
    t.scheduled_start AS training_date,
    t.status AS training_status,
    COUNT(ta.id) AS total_invited,
    SUM(CASE WHEN ta.attendance_status = 'attended' THEN 1 ELSE 0 END) AS attended_count,
    SUM(CASE WHEN ta.attendance_status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
    SUM(CASE WHEN ta.attendance_status = 'excused' THEN 1 ELSE 0 END) AS excused_count,
    SUM(CASE WHEN ta.attendance_status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
    ROUND(
        100.0 * SUM(CASE WHEN ta.attendance_status = 'attended' THEN 1 ELSE 0 END) / 
        NULLIF(COUNT(ta.id), 0), 
        2
    ) AS attendance_rate_percent
FROM trainings t
LEFT JOIN training_attendees ta ON t.id = ta.training_id
GROUP BY t.id, t.title, t.scheduled_start, t.status
ORDER BY t.scheduled_start DESC;


-- =========================================================================
-- REPORT 3: Branch-wise training completion rates
-- =========================================================================
-- Evaluates the physical branches of Axis Bank, showing overall employee 
-- attendance performance and task completion metrics of employees from each branch.

SELECT 
    b.id AS branch_id,
    b.branch_code,
    b.name AS branch_name,
    COUNT(DISTINCT e.id) AS total_branch_employees,
    
    -- Attendance statistics for employees belonging to this branch
    COUNT(ta.id) AS total_training_invites,
    SUM(CASE WHEN ta.attendance_status = 'attended' THEN 1 ELSE 0 END) AS total_attended,
    ROUND(
        100.0 * SUM(CASE WHEN ta.attendance_status = 'attended' THEN 1 ELSE 0 END) / 
        NULLIF(COUNT(ta.id), 0), 
        2
    ) AS branch_attendance_rate_percent,
    
    -- Task statistics for employees belonging to this branch
    COUNT(at.id) AS total_tasks_assigned,
    SUM(CASE WHEN at.is_completed = TRUE THEN 1 ELSE 0 END) AS total_tasks_completed,
    ROUND(
        100.0 * SUM(CASE WHEN at.is_completed = TRUE THEN 1 ELSE 0 END) / 
        NULLIF(COUNT(at.id), 0), 
        2
    ) AS branch_task_completion_rate_percent
FROM branches b
LEFT JOIN employees e ON b.id = e.branch_id
LEFT JOIN training_attendees ta ON e.id = ta.employee_id
LEFT JOIN attendee_tasks at ON e.id = at.employee_id
GROUP BY b.id, b.branch_code, b.name
ORDER BY branch_attendance_rate_percent DESC, branch_task_completion_rate_percent DESC;


-- =========================================================================
-- REPORT 4: Task completion rates per training
-- =========================================================================
-- Calculates the completion rates of all action items/tasks assigned 
-- specifically to attendees of each training.

SELECT 
    t.id AS training_id,
    t.title AS training_title,
    t.scheduled_start AS training_date,
    COUNT(DISTINCT tk.id) AS unique_tasks_created,
    COUNT(at.id) AS total_individual_assignments, -- (tasks * attendees)
    SUM(CASE WHEN at.is_completed = TRUE THEN 1 ELSE 0 END) AS completed_assignments,
    ROUND(
        100.0 * SUM(CASE WHEN at.is_completed = TRUE THEN 1 ELSE 0 END) / 
        NULLIF(COUNT(at.id), 0), 
        2
    ) AS task_completion_rate_percent
FROM trainings t
LEFT JOIN tasks tk ON t.id = tk.training_id
LEFT JOIN attendee_tasks at ON tk.id = at.task_id
GROUP BY t.id, t.title, t.scheduled_start
ORDER BY t.scheduled_start DESC;
