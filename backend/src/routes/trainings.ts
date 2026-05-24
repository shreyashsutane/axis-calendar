import { Router } from 'express';
import { authenticateToken, requireManager } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  CreateTrainingSchema,
  UpdateTrainingSchema,
  SubmitAttendanceSchema,
  CreateTaskSchema,
  CompleteTaskSchema,
} from '../middleware/schemas';
import { TrainingController } from '../controllers/trainingController';

const router = Router();

// Apply authentication middleware to all training endpoints
router.use(authenticateToken as any);

// 1. GET /api/v1/trainings
// List all trainings (filtered calendar dates, role restrictions mapped inside service)
router.get('/', TrainingController.listTrainings as any);

// 2. GET /api/v1/trainings/:id
// Details of specific training session (attendees lists and checklist states)
router.get('/:id', TrainingController.getTrainingDetail as any);

// 3. POST /api/v1/trainings
// Create new training session (Manager restricted, targets branches automatically)
router.post(
  '/',
  requireManager as any,
  validate({ body: CreateTrainingSchema }),
  TrainingController.createTraining as any
);

// 4. PUT /api/v1/trainings/:id
// Reschedule or edit a training session (Manager restricted, triggers rescheduling logs)
router.put(
  '/:id',
  requireManager as any,
  validate({ body: UpdateTrainingSchema }),
  TrainingController.updateTraining as any
);

// 5. DELETE /api/v1/trainings/:id
// Cancel training session (Manager restricted, retains canceled logs for audit retention)
router.delete(
  '/:id',
  requireManager as any,
  TrainingController.cancelTraining as any
);

// 6. PUT /api/v1/trainings/:id/attendance
// Log employee check-in or manage overrides (includes geofence and 15min checks inside service)
router.put(
  '/:id/attendance',
  validate({ body: SubmitAttendanceSchema }),
  TrainingController.recordAttendance as any
);

// 7. POST /api/v1/trainings/:id/tasks
// Allocate checklist tasks (Manager restricted, batch distributes assignments)
router.post(
  '/:id/tasks',
  requireManager as any,
  validate({ body: CreateTaskSchema }),
  TrainingController.createTask as any
);

// 8. PUT /api/v1/trainings/tasks/:taskId/complete
// Employee ticks off assigned training tasks
router.put(
  '/tasks/:taskId/complete',
  validate({ body: CompleteTaskSchema }),
  TrainingController.completeTask as any
);

export default router;
