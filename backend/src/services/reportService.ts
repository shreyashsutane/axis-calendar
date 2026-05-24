import db from '../config/db';

export class ReportService {
  public static async getTrainingsSummary() {
    const result = await db.query(`
      SELECT 
          EXTRACT(YEAR FROM scheduled_start)::INTEGER AS year,
          EXTRACT(MONTH FROM scheduled_start)::INTEGER AS month,
          EXTRACT(DAY FROM scheduled_start)::INTEGER AS day,
          COUNT(*)::INTEGER AS total,
          COUNT(CASE WHEN status = 'scheduled' THEN 1 END)::INTEGER AS scheduled,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::INTEGER AS cancelled,
          COUNT(CASE WHEN status = 'rescheduled' THEN 1 END)::INTEGER AS rescheduled
      FROM trainings
      GROUP BY 
          EXTRACT(YEAR FROM scheduled_start),
          EXTRACT(MONTH FROM scheduled_start),
          EXTRACT(DAY FROM scheduled_start)
      ORDER BY 
          year DESC, 
          month DESC, 
          day DESC;
    `);
    return result.rows;
  }

  public static async getAttendanceMetrics() {
    // 2A: Global attendance aggregate rate metrics
    const globalRes = await db.query(`
      SELECT 
          attendance_status AS status,
          COUNT(*)::INTEGER AS count,
          ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2)::FLOAT AS percentage
      FROM training_attendees
      GROUP BY attendance_status;
    `);

    // 2B: Detailed attendance per training session
    const detailedRes = await db.query(`
      SELECT 
          t.id AS training_id,
          t.title AS training_title,
          t.scheduled_start AS training_date,
          t.status AS training_status,
          COUNT(ta.id)::INTEGER AS total_invited,
          SUM(CASE WHEN ta.attendance_status = 'attended' THEN 1 ELSE 0 END)::INTEGER AS attended_count,
          SUM(CASE WHEN ta.attendance_status = 'absent' THEN 1 ELSE 0 END)::INTEGER AS absent_count,
          SUM(CASE WHEN ta.attendance_status = 'excused' THEN 1 ELSE 0 END)::INTEGER AS excused_count,
          SUM(CASE WHEN ta.attendance_status = 'pending' THEN 1 ELSE 0 END)::INTEGER AS pending_count,
          ROUND(
              100.0 * SUM(CASE WHEN ta.attendance_status = 'attended' THEN 1 ELSE 0 END) / 
              NULLIF(COUNT(ta.id), 0), 
              2
          )::FLOAT AS attendance_rate_percent
      FROM trainings t
      LEFT JOIN training_attendees ta ON t.id = ta.training_id
      GROUP BY t.id, t.title, t.scheduled_start, t.status
      ORDER BY t.scheduled_start DESC;
    `);

    return {
      global_summary: globalRes.rows,
      detailed_sessions: detailedRes.rows,
    };
  }

  public static async getBranchCompletion() {
    const result = await db.query(`
      SELECT 
          b.id AS branch_id,
          b.branch_code,
          b.name AS branch_name,
          COUNT(DISTINCT e.id)::INTEGER AS total_branch_employees,
          
          -- Attendance statistics (using NULLIF division-by-zero protection)
          COUNT(ta.id)::INTEGER AS total_training_invites,
          SUM(CASE WHEN ta.attendance_status = 'attended' THEN 1 ELSE 0 END)::INTEGER AS total_attended,
          COALESCE(ROUND(
              100.0 * SUM(CASE WHEN ta.attendance_status = 'attended' THEN 1 ELSE 0 END) / 
              NULLIF(COUNT(ta.id), 0), 
              2
          ), 0.0)::FLOAT AS branch_attendance_rate_percent,
          
          -- Task statistics (using NULLIF division-by-zero protection)
          COUNT(at.id)::INTEGER AS total_tasks_assigned,
          SUM(CASE WHEN at.is_completed = TRUE THEN 1 ELSE 0 END)::INTEGER AS total_tasks_completed,
          COALESCE(ROUND(
              100.0 * SUM(CASE WHEN at.is_completed = TRUE THEN 1 ELSE 0 END) / 
              NULLIF(COUNT(at.id), 0), 
              2
          ), 0.0)::FLOAT AS branch_task_completion_rate_percent
      FROM branches b
      LEFT JOIN employees e ON b.id = e.branch_id
      LEFT JOIN training_attendees ta ON e.id = ta.employee_id
      LEFT JOIN attendee_tasks at ON e.id = at.employee_id
      GROUP BY b.id, b.branch_code, b.name
      ORDER BY branch_attendance_rate_percent DESC, branch_task_completion_rate_percent DESC;
    `);
    return result.rows;
  }

  public static async getTaskCompletion() {
    const result = await db.query(`
      SELECT 
          t.id AS training_id,
          t.title AS training_title,
          t.scheduled_start AS training_date,
          COUNT(DISTINCT tk.id)::INTEGER AS unique_tasks_created,
          COUNT(at.id)::INTEGER AS total_individual_assignments,
          SUM(CASE WHEN at.is_completed = TRUE THEN 1 ELSE 0 END)::INTEGER AS completed_assignments,
          COALESCE(ROUND(
              100.0 * SUM(CASE WHEN at.is_completed = TRUE THEN 1 ELSE 0 END) / 
              NULLIF(COUNT(at.id), 0), 
              2
          ), 0.0)::FLOAT AS task_completion_rate_percent
      FROM trainings t
      LEFT JOIN tasks tk ON t.id = tk.training_id
      LEFT JOIN attendee_tasks at ON tk.id = at.task_id
      GROUP BY t.id, t.title, t.scheduled_start
      ORDER BY t.scheduled_start DESC;
    `);
    return result.rows;
  }

  public static async getTeamAttendance(managerId: string, branchId: string) {
    // 1. Fetch trainings scheduled by this manager or managers in the same branch
    const trainingsRes = await db.query(
      `SELECT t.id, t.title, t.description, t.scheduled_start, t.scheduled_end, t.status, t.training_type,
              e.first_name AS manager_first, e.last_name AS manager_last,
              (e.id = $1) AS scheduled_by_self
       FROM trainings t
       JOIN employees e ON t.manager_id = e.id
       WHERE t.manager_id = $1
          OR (e.role = 'manager' AND e.branch_id = $2)
       ORDER BY t.scheduled_start DESC`,
      [managerId, branchId]
    );

    const trainings = trainingsRes.rows;

    // 2. Fetch attendees and their status for all these trainings
    const detailedPromises = trainings.map(async (t) => {
      const attendeesRes = await db.query(
        `SELECT ta.attendance_status, ta.marked_at,
                e.first_name, e.last_name, e.employee_id, b.name AS branch_name
         FROM training_attendees ta
         JOIN employees e ON ta.employee_id = e.id
         LEFT JOIN branches b ON e.branch_id = b.id
         WHERE ta.training_id = $1
         ORDER BY e.first_name ASC`,
        [t.id]
      );
      return {
        ...t,
        attendees: attendeesRes.rows,
      };
    });

    return Promise.all(detailedPromises);
  }
}
