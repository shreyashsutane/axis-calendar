import { Router, Response } from 'express';
import { authenticateToken, requireManager, AuthenticatedRequest } from '../middleware/auth';
import db from '../config/db';

const router = Router();

// Temporary Migration Endpoint to alter table schemas in live GCP Cloud SQL
router.get('/migrate-db', async (req: any, res: Response) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE trainings ADD COLUMN IF NOT EXISTS training_type VARCHAR(10) DEFAULT 'online';
    `);
    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Database columns successfully migrated!' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Migration error:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Apply authentication middleware to all training endpoints
router.use(authenticateToken as any);

// 1. GET /api/v1/trainings
// Fetches trainings filtered by date range. Employees only see their registered calendars; Managers see all.
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { start_date, end_date } = req.query;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  try {
    let queryText = '';
    const queryParams: any[] = [];
    let paramCounter = 1;

    if (userRole === 'manager') {
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

    // Add optional date range filter (ideal for Google Calendar Day/Week/Month query limits)
    if (start_date && end_date) {
      queryText += ` AND t.scheduled_start >= $${paramCounter} AND t.scheduled_start <= $${paramCounter + 1}`;
      queryParams.push(start_date, end_date);
      paramCounter += 2;
    }

    queryText += ` ORDER BY t.scheduled_start ASC`;

    const trainingsRes = await db.query(queryText, queryParams);
    
    return res.status(200).json({
      success: true,
      data: trainingsRes.rows,
      meta: { count: trainingsRes.rows.length }
    });
  } catch (err: any) {
    console.error('Error fetching trainings list:', err);
    return res.status(500).json({ success: false, error: 'Internal database error.' });
  }
});

// 2. GET /api/v1/trainings/:id
// Retrieves full detail of a training session, including attendees and task stats
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const trainingRes = await db.query(
      `SELECT t.*, e.first_name AS manager_first, e.last_name AS manager_last 
       FROM trainings t
       JOIN employees e ON t.manager_id = e.id
       WHERE t.id = $1`,
      [id]
    );

    if (trainingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Training session not found.' });
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

    return res.status(200).json({
      success: true,
      data: {
        ...training,
        attendees: attendeesRes.rows,
        tasks: tasksRes.rows,
      }
    });
  } catch (err: any) {
    console.error('Error fetching training detail:', err);
    return res.status(500).json({ success: false, error: 'Internal database detail error.' });
  }
});

// 3. POST /api/v1/trainings (Manager restricted)
// Creates a training session and dynamically registers attendees belonging to target branches
router.post('/', requireManager as any, async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, scheduled_start, scheduled_end, target_branch_ids, training_type } = req.body;
  const managerId = req.user?.id;

  if (!title || !scheduled_start || !scheduled_end) {
    return res.status(400).json({ success: false, error: 'Title and schedule dates are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Create training
    const trainingRes = await client.query(
      `INSERT INTO trainings (title, description, scheduled_start, scheduled_end, manager_id, status, training_type)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)
       RETURNING *`,
      [title, description || null, scheduled_start, scheduled_end, managerId, training_type || 'online']
    );
    const newTraining = trainingRes.rows[0];

    // If target branches are selected, query and register all matching employees automatically
    if (target_branch_ids && Array.isArray(target_branch_ids) && target_branch_ids.length > 0) {
      const employeesRes = await client.query(
        `SELECT id FROM employees WHERE branch_id = ANY($1) AND role = 'employee'`,
        [target_branch_ids]
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
      console.log(`Enrolled ${employeesRes.rows.length} branch employees to training ${newTraining.id}`);
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true, data: newTraining });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error creating training:', err);
    return res.status(500).json({ success: false, error: 'Database creation rollback error.' });
  } finally {
    client.release();
  }
});

// 4. PUT /api/v1/trainings/:id (Manager restricted)
// Edits or Reschedules training (handles rescheduling lineage updates automatically)
router.put('/:id', requireManager as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { title, description, scheduled_start, scheduled_end, status, training_type } = req.body;

  try {
    // Retrieve current event state first
    const checkRes = await db.query(`SELECT * FROM trainings WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Training session not found.' });
    }

    const currentTraining = checkRes.rows[0];
    let updatedStatus = status || currentTraining.status;
    let originalStartTime = currentTraining.original_start_time;
    let rescheduledFromId = currentTraining.rescheduled_from_id;

    // Detect if scheduled time is shifting (indicating a Reschedule request)
    const isTimeShifted = scheduled_start && 
      new Date(scheduled_start).getTime() !== new Date(currentTraining.scheduled_start).getTime();

    if (isTimeShifted || status === 'rescheduled') {
      updatedStatus = 'rescheduled';
      // Audit trail: set original starting time only on the first rescheduling action
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
        title || currentTraining.title,
        description !== undefined ? description : currentTraining.description,
        scheduled_start || currentTraining.scheduled_start,
        scheduled_end || currentTraining.scheduled_end,
        updatedStatus,
        originalStartTime,
        rescheduledFromId,
        training_type || currentTraining.training_type,
        id
      ]
    );

    return res.status(200).json({ success: true, data: updateRes.rows[0] });
  } catch (err: any) {
    console.error('Error updating training:', err);
    return res.status(500).json({ success: false, error: 'Database update failed.' });
  }
});

// 5. DELETE /api/v1/trainings/:id (Manager restricted)
// Cancels a training session (keeps record with status = 'cancelled' for analytics retention)
router.delete('/:id', requireManager as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const checkRes = await db.query(`SELECT * FROM trainings WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Training session not found.' });
    }

    const cancelRes = await db.query(
      `UPDATE trainings 
       SET status = 'cancelled', cancelled_reason = $1 
       WHERE id = $2
       RETURNING *`,
      [reason || 'No cancellation reason specified', id]
    );

    return res.status(200).json({ 
      success: true, 
      message: 'Training marked as cancelled successfully.', 
      data: cancelRes.rows[0] 
    });
  } catch (err: any) {
    console.error('Error cancelling training:', err);
    return res.status(500).json({ success: false, error: 'Database cancellation update failed.' });
  }
});

// Helper function to calculate GPS distance using Haversine Formula
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 6. PUT /api/v1/trainings/:id/attendance
// Records attendance values. Employees can check in themselves; Managers can batch override.
router.put('/:id/attendance', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { attendance, latitude, longitude } = req.body; // Expecting Array: [{"employee_id": "...", "status": "attended"}]
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!attendance || !Array.isArray(attendance)) {
    return res.status(400).json({ success: false, error: 'Invalid attendance payloads array structure.' });
  }

  try {
    // 1. Fetch training session to verify details
    const trainingRes = await db.query('SELECT * FROM trainings WHERE id = $1', [id]);
    if (trainingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Training session not found.' });
    }
    const training = trainingRes.rows[0];

    // 2. Perform validation checks if marked by employee
    if (userRole === 'employee') {
      const now = new Date();
      const scheduledEnd = new Date(training.scheduled_end);
      const diffMs = now.getTime() - scheduledEnd.getTime();
      const diffMinutes = diffMs / (60 * 1000);

      // Check-in window constraint: Must be after scheduled_end and within 15 minutes
      if (diffMs < 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Attendance check-in can only be submitted after the training session has ended.' 
        });
      }
      if (diffMinutes > 15) {
        return res.status(400).json({ 
          success: false, 
          error: 'The 15-minute attendance check-in window for this session has expired.' 
        });
      }

      // Geofence constraint: Offline sessions require branch location geofence matching (50m)
      if (training.training_type === 'offline') {
        if (latitude === undefined || longitude === undefined) {
          return res.status(400).json({ 
            success: false, 
            error: 'GPS coordinates are required to check in for offline sessions.' 
          });
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
          return res.status(404).json({ success: false, error: 'Employee profile not found.' });
        }

        const empProfile = empBranchRes.rows[0];
        if (empProfile.latitude === null || empProfile.longitude === null) {
          return res.status(400).json({ 
            success: false, 
            error: 'No GPS coordinates configured for your assigned branch. Please contact system administrator.' 
          });
        }

        const distance = calculateHaversineDistance(latitude, longitude, empProfile.latitude, empProfile.longitude);
        if (distance > 50) {
          return res.status(400).json({ 
            success: false, 
            error: `Geofence check failed. You are currently ${Math.round(distance)}m away from your assigned branch (${empProfile.branch_name}), which exceeds the maximum allowable geofence of 50m.` 
          });
        }
        console.log(`Geofence verification passed: Employee is ${Math.round(distance)}m from branch ${empProfile.branch_name}`);
      }
    }

    const updatePromises = attendance.map(async (item) => {
      // Authorization Guard: Standard employees can only mark their own attendance
      if (userRole === 'employee' && item.employee_id !== userId) {
        return Promise.resolve({ success: false, error: 'Employees cannot log attendance for others.' });
      }

      return db.query(
        `UPDATE training_attendees 
         SET attendance_status = $1, marked_at = CURRENT_TIMESTAMP, marked_by_id = $2
         WHERE training_id = $3 AND employee_id = $4
         RETURNING *`,
        [item.status, userId, id, item.employee_id]
      );
    });

    const results = await Promise.all(updatePromises);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Attendance mapped successfully.' 
    });
  } catch (err: any) {
    console.error('Error mapping attendance:', err);
    return res.status(500).json({ success: false, error: 'Internal attendance update error.' });
  }
});

// 7. POST /api/v1/trainings/:id/tasks (Manager restricted)
// Creates a new task and assigns it to all attendees registered to the training
router.post('/:id/tasks', requireManager as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { title, description, due_date } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Task title is required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Create task row
    const taskRes = await client.query(
      `INSERT INTO tasks (training_id, title, description, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, title, description || null, due_date || null]
    );
    const newTask = taskRes.rows[0];

    // Find all enrolled attendees
    const attendeesRes = await client.query(
      `SELECT employee_id FROM training_attendees WHERE training_id = $1`,
      [id]
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
    return res.status(201).json({ success: true, data: newTask, assignedCount: attendeesRes.rows.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error creating training task:', err);
    return res.status(500).json({ success: false, error: 'Database task creation failed.' });
  } finally {
    client.release();
  }
});

// 8. PUT /api/v1/tasks/:taskId/complete
// Allows standard employees to toggle checkoff tasks as complete / incomplete
router.put('/tasks/:taskId/complete', async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const { is_completed } = req.body; // Boolean
  const userId = req.user?.id;

  try {
    const updateRes = await db.query(
      `UPDATE attendee_tasks 
       SET is_completed = $1, completed_at = $2
       WHERE task_id = $3 AND employee_id = $4
       RETURNING *`,
      [is_completed, is_completed ? new Date() : null, taskId, userId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Task assignment connection not found for this employee.' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Task progress updated successfully.',
      data: updateRes.rows[0] 
    });
  } catch (err: any) {
    console.error('Error ticking off task:', err);
    return res.status(500).json({ success: false, error: 'Database task progress update failed.' });
  }
});

export default router;
