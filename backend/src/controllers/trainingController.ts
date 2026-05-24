import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { TrainingService } from '../services/trainingService';

export class TrainingController {
  public static async listTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { start_date, end_date } = req.query as { start_date?: string; end_date?: string };
    const userId = req.user?.id;
    const role = req.user?.role;

    try {
      const data = await TrainingService.listTrainings(userId!, role!, start_date, end_date);
      return res.status(200).json({
        success: true,
        data,
        meta: { count: data.length },
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async getTrainingDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { id } = req.params;

    try {
      const data = await TrainingService.getTrainingDetail(id);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async createTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const managerId = req.user?.id;
    const { title, description, scheduled_start, scheduled_end, target_branch_ids, training_type } = req.body;

    try {
      const data = await TrainingService.createTraining(managerId!, {
        title,
        description,
        scheduled_start,
        scheduled_end,
        target_branch_ids,
        training_type,
      });
      
      return res.status(201).json({
        success: true,
        data,
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async updateTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { id } = req.params;
    const { title, description, scheduled_start, scheduled_end, status, training_type } = req.body;

    try {
      const data = await TrainingService.updateTraining(id, {
        title,
        description,
        scheduled_start,
        scheduled_end,
        status,
        training_type,
      });
      
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async cancelTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { id } = req.params;
    const { reason } = req.body;

    try {
      const data = await TrainingService.cancelTraining(id, reason);
      
      return res.status(200).json({
        success: true,
        message: 'Training marked as cancelled successfully.',
        data,
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async recordAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { id } = req.params;
    const { attendance, latitude, longitude } = req.body;
    const userId = req.user?.id;
    const role = req.user?.role;

    try {
      await TrainingService.recordAttendance(id, userId!, role!, {
        attendance,
        latitude,
        longitude,
      });
      
      return res.status(200).json({
        success: true,
        message: 'Attendance mapped successfully.',
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async createTask(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { id } = req.params;
    const { title, description, due_date } = req.body;

    try {
      const result = await TrainingService.createTask(id, {
        title,
        description,
        due_date,
      });
      
      return res.status(201).json({
        success: true,
        data: result.task,
        assignedCount: result.assignedCount,
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async completeTask(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { taskId } = req.params;
    const { is_completed } = req.body;
    const userId = req.user?.id;

    try {
      const data = await TrainingService.completeTask(taskId, userId!, is_completed);
      
      return res.status(200).json({
        success: true,
        message: 'Task progress updated successfully.',
        data,
      });
    } catch (err) {
      return next(err);
    }
  }
}
