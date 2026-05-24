import { Router } from 'express';
import { authenticateToken, requireManager } from '../middleware/auth';
import { ReportController } from '../controllers/reportController';

const router = Router();

// Apply administrative middlewares to all reports endpoints
router.use(authenticateToken as any);
router.use(requireManager as any);

// REPORT 1: GET /api/v1/reports/trainings-summary
// scheduled, rescheduled, and cancelled training counts by date
router.get('/trainings-summary', ReportController.getTrainingsSummary as any);

// REPORT 2: GET /api/v1/reports/attendance-metrics
// Compiles global totals and detailed attendance per session
router.get('/attendance-metrics', ReportController.getAttendanceMetrics as any);

// REPORT 3: GET /api/v1/reports/branch-completion
// Evaluates branches by mapping employee attendance and task completion rates
router.get('/branch-completion', ReportController.getBranchCompletion as any);

// REPORT 4: GET /api/v1/reports/task-completion
// Measures individual task progress completion rates for each specific training program
router.get('/task-completion', ReportController.getTaskCompletion as any);

// REPORT 5: GET /api/v1/reports/team-attendance
// Detailed attendance rosters for trainings scheduled under this branch manager
router.get('/team-attendance', ReportController.getTeamAttendance as any);

export default router;
