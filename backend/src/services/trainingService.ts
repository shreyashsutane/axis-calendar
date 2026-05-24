import db from '../config/db';
import { AppError } from '../middleware/errors';

export class TrainingService {
  // Helper function to calculate GPS distance using Haversine Formula
  private static calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public static async listTrainings(userId: string, role: string, startDate?: string, endDate?: string) {
    let queryText = '';
    const queryParams: any[] = [];
    let paramCounter = 1;

    if (role === 'manager') {
      // Managers retrieve all trainings
      queryText = `
        SELECT t.*, e.first_name AS manager_first, e.last_name AS manager_last 
        FROM trainings t
        JOIN employees e ON t.manager_id = e.id
        WHERE 1=1
      `;
    } else {
      // Standard employees retrieve only trainings they are enrolled in
      queryText = `
        SELECT t.*, ta.attendance_status, e.first_name AS manager_first, e.last_name AS manager_last
        FROM trainings t
        JOIN training_attendees ta ON t.id = ta.training_id
        JOIN employees e ON t.manager_id = e.id
        WHERE ta.employee_id = $${paramCounter}
      `;
      queryParams.push(userId);
      paramCounter++;
    }

    // Add optional date range filter
    if (startDate && endDate) {
      queryText += ` AND t.scheduled_start >= $${paramCounter} AND t.scheduled_start <= $${paramCounter + 1}`;
      queryParams.push(startDate, endDate);
      paramCounter += 2;
    }

    queryText += ` ORDER BY t.scheduled_start ASC`;

    const result = await db.query(queryText, queryParams);
    return result.rows;
  }

  public static async getTrainingDetail(id: string | number) {
    const trainingRes = await db.query(
      `SELECT t.*, e.first_name AS manager_first, e.last_name AS manager_last 
       FROM trainings t
       JOIN employees e ON t.manager_id = e.id
       WHERE t.id = $1`,
      [id]
    );

    if (trainingRes.rows.length === 0) {
      throw new AppError('Training session not found.', 404, 'TRAINING_NOT_FOUND');
    }

    const training = trainingRes.rows[0];

    // Fetch enrolled attendees
    const attendeesRes = await db.query(
      `SELECT ta.id AS roster_id, ta.attendance_status, ta.marked_at, 
              e.id AS employee_id, e.employee_id AS employee_code, e.first_name, e.last_name, e.email, b.name AS branch_name
       FROM training_attendees ta
       JOIN employees e ON ta.employee_id = e.id
       LEFT JOIN branches b ON e.branch_id = b.id
       WHERE ta.training_id = $1`,
      [id]
    );

    // Fetch tasks associated with this training
    const tasksRes = await db.query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM attendee_tasks WHERE task_id = t.id) AS total_assigned,
              (SELECT COUNT(*) FROM attendee_tasks WHERE task_id = t.id AND is_completed = TRUE) AS total_completed
       FROM tasks t
       WHERE t.training_id = $1`,
      [id]
    );

    return {
      ...training,
      attendees: attendeesRes.rows,
      tasks: tasksRes.rows,
    };
  }

  public static async createTraining(
    managerId: string,
    payload: {
      title: string;
      description?: string;
      scheduled_start: string;
      scheduled_end: string;
      target_branch_ids?: (string | number)[];
      training_type?: 'online' | 'offline';
    }
  ) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Create training
      const trainingRes = await client.query(
        `INSERT INTO trainings (title, description, scheduled_start, scheduled_end, manager_id, status, training_type)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)
         RETURNING *`,
        [
          payload.title,
          payload.description || null,
          payload.scheduled_start,
          payload.scheduled_end,
          managerId,
          payload.training_type || 'online',
        ]
      );
      const newTraining = trainingRes.rows[0];

      // If target branches are selected, query and register all matching employees automatically
      if (
        payload.target_branch_ids &&
        Array.isArray(payload.target_branch_ids) &&
        payload.target_branch_ids.length > 0
      ) {
        const employeesRes = await client.query(
          `SELECT id FROM employees WHERE branch_id = ANY($1) AND role = 'employee'`,
          [payload.target_branch_ids]
        );

        if (employeesRes.rows.length > 0) {
          const attendeeInserts = employeesRes.rows.map((row) =>
            client.query(
              `INSERT INTO training_attendees (training_id, employee_id, attendance_status) 
               VALUES ($1, $2, 'pending') 
               ON CONFLICT (training_id, employee_id) DO NOTHING`,
              [newTraining.id, row.id]
            )
          );
          await Promise.all(attendeeInserts);
        }
      }

      await client.query('COMMIT');
      return newTraining;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public static async updateTraining(
    id: string | number,
    payload: {
      title?: string;
      description?: string;
      scheduled_start?: string;
      scheduled_end?: string;
      status?: 'scheduled' | 'rescheduled' | 'cancelled';
      training_type?: 'online' | 'offline';
    }
  ) {
    // Retrieve current event state first
    const checkRes = await db.query(`SELECT * FROM trainings WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) {
      throw new AppError('Training session not found.', 404, 'TRAINING_NOT_FOUND');
    }

    const currentTraining = checkRes.rows[0];
    let updatedStatus = payload.status || currentTraining.status;
    let originalStartTime = currentTraining.original_start_time;
    let rescheduledFromId = currentTraining.rescheduled_from_id;

    // Detect if scheduled time is shifting (indicating a Reschedule request)
    const isTimeShifted =
      payload.scheduled_start &&
      new Date(payload.scheduled_start).getTime() !== new Date(currentTraining.scheduled_start).getTime();

    if (isTimeShifted || payload.status === 'rescheduled') {
      updatedStatus = 'rescheduled';
      if (!originalStartTime) {
        originalStartTime = currentTraining.scheduled_start;
      }
    }

    const updateRes = await db.query(
      `UPDATE trainings 
       SET title = $1, description = $2, scheduled_start = $3, scheduled_end = $4, 
           status = $5, original_start_time = $6, rescheduled_from_id = $7, training_type = $8
       WHERE id = $9
       RETURNING *`,
      [
        payload.title || currentTraining.title,
        payload.description !== undefined ? payload.description : currentTraining.description,
        payload.scheduled_start || currentTraining.scheduled_start,
        payload.scheduled_end || currentTraining.scheduled_end,
        updatedStatus,
        originalStartTime,
        rescheduledFromId,
        payload.training_type || currentTraining.training_type,
        id,
      ]
    );

    return updateRes.rows[0];
  }

  public static async cancelTraining(id: string | number, reason?: string) {
    const checkRes = await db.query(`SELECT * FROM trainings WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) {
      throw new AppError('Training session not found.', 404, 'TRAINING_NOT_FOUND');
    }

    const cancelRes = await db.query(
      `UPDATE trainings 
       SET status = 'cancelled', cancelled_reason = $1 
       WHERE id = $2
       RETURNING *`,
      [reason || 'No cancellation reason specified', id]
    );

    return cancelRes.rows[0];
  }

  public static async recordAttendance(
    id: string | number,
    userId: string,
    role: 'manager' | 'employee',
    payload: {
      attendance: { employee_id: string | number; status: 'attended' | 'absent' | 'excused' | 'pending' }[];
      latitude?: number;
      longitude?: number;
    }
  ) {
    // 1. Fetch training session to verify details
    const trainingRes = await db.query('SELECT * FROM trainings WHERE id = $1', [id]);
    if (trainingRes.rows.length === 0) {
      throw new AppError('Training session not found.', 404, 'TRAINING_NOT_FOUND');
    }
    const training = trainingRes.rows[0];

    // 2. Perform validation checks if marked by employee
    if (role === 'employee') {
      const now = new Date();
      const scheduledEnd = new Date(training.scheduled_end);
      const diffMs = now.getTime() - scheduledEnd.getTime();
      const diffMinutes = diffMs / (60 * 1000);

      // Check-in window constraint
      if (diffMs < 0) {
        throw new AppError(
          'Attendance check-in can only be submitted after the training session has ended.',
          400,
          'SESSION_NOT_ENDED'
        );
      }
      if (diffMinutes > 15) {
        throw new AppError(
          'The 15-minute attendance check-in window for this session has expired.',
          400,
          'CHECKIN_WINDOW_EXPIRED'
        );
      }

      // Geofence constraint: Offline sessions require branch location geofence matching (50m)
      if (training.training_type === 'offline') {
        if (payload.latitude === undefined || payload.longitude === undefined) {
          throw new AppError('GPS coordinates are required to check in for offline sessions.', 400, 'COORDINATES_REQUIRED');
        }

        // Fetch employee's assigned branch coordinates
        const empBranchRes = await db.query(
          `SELECT e.id, e.branch_id, b.name AS branch_name, b.latitude, b.longitude 
           FROM employees e
           LEFT JOIN branches b ON e.branch_id = b.id
           WHERE e.id = $1`,
          [userId]
        );

        if (empBranchRes.rows.length === 0) {
          throw new AppError('Employee profile not found.', 404, 'EMPLOYEE_NOT_FOUND');
        }

        const empProfile = empBranchRes.rows[0];
        if (empProfile.latitude === null || empProfile.longitude === null) {
          throw new AppError(
            'No GPS coordinates configured for your assigned branch. Please contact system administrator.',
            400,
            'BRANCH_COORDINATES_UNCONFIGURED'
          );
        }

        const distance = this.calculateHaversineDistance(
          payload.latitude,
          payload.longitude,
          empProfile.latitude,
          empProfile.longitude
        );
        
        if (distance > 50) {
          throw new AppError(
            `Geofence check failed. You are currently ${Math.round(distance)}m away from your assigned branch (${empProfile.branch_name}), which exceeds the maximum allowable geofence of 50m.`,
            400,
            'GEOFENCE_CHECK_FAILED'
          );
        }
      }
    }

    const updatePromises = payload.attendance.map(async (item) => {
      // Authorization Guard: Standard employees can only mark their own attendance
      if (role === 'employee' && String(item.employee_id) !== String(userId)) {
        throw new AppError('Employees cannot log attendance for others.', 403, 'ACCESS_DENIED');
      }

      return db.query(
        `UPDATE training_attendees 
         SET attendance_status = $1, marked_at = CURRENT_TIMESTAMP, marked_by_id = $2
         WHERE training_id = $3 AND employee_id = $4
         RETURNING *`,
        [item.status, userId, id, item.employee_id]
      );
    });

    await Promise.all(updatePromises);
  }

  public static async createTask(
    trainingId: string | number,
    payload: { title: string; description?: string; due_date?: string }
  ) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Create task row
      const taskRes = await client.query(
        `INSERT INTO tasks (training_id, title, description, due_date)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [trainingId, payload.title, payload.description || null, payload.due_date || null]
      );
      const newTask = taskRes.rows[0];

      // Find all enrolled attendees
      const attendeesRes = await client.query(
        `SELECT employee_id FROM training_attendees WHERE training_id = $1`,
        [trainingId]
      );

      // Bulk allocate attendee_tasks assignments
      if (attendeesRes.rows.length > 0) {
        const assignmentPromises = attendeesRes.rows.map((row) =>
          client.query(
            `INSERT INTO attendee_tasks (task_id, employee_id, is_completed) 
             VALUES ($1, $2, FALSE)
             ON CONFLICT (task_id, employee_id) DO NOTHING`,
            [newTask.id, row.employee_id]
          )
        );
        await Promise.all(assignmentPromises);
      }

      await client.query('COMMIT');
      return { task: newTask, assignedCount: attendeesRes.rows.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public static async completeTask(taskId: string | number, userId: string, isCompleted: boolean) {
    const updateRes = await db.query(
      `UPDATE attendee_tasks 
       SET is_completed = $1, completed_at = $2
       WHERE task_id = $3 AND employee_id = $4
       RETURNING *`,
      [isCompleted, isCompleted ? new Date() : null, taskId, userId]
    );

    if (updateRes.rows.length === 0) {
      throw new AppError('Task assignment connection not found for this employee.', 404, 'TASK_ASSIGNMENT_NOT_FOUND');
    }

    return updateRes.rows[0];
  }
}
