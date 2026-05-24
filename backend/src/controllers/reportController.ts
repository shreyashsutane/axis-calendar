import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ReportService } from '../services/reportService';

export class ReportController {
  public static async getTrainingsSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getTrainingsSummary();
      return res.status(200).json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async getAttendanceMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getAttendanceMetrics();
      return res.status(200).json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async getBranchCompletion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getBranchCompletion();
      return res.status(200).json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async getTaskCompletion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getTaskCompletion();
      return res.status(200).json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async getTeamAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const managerId = req.user?.id;
    const branchId = req.user?.branch_id;

    try {
      const data = await ReportService.getTeamAttendance(managerId!, branchId!);
      return res.status(200).json({
        success: true,
        data,
        meta: { count: data.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      return next(err);
    }
  }
}
