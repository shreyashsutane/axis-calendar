import { z } from 'zod';

export const LoginSchema = z.object({
  email_or_id: z.string().min(1, 'Email or Employee ID is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const RegisterSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required.'),
  first_name: z.string().min(1, 'First name is required.'),
  last_name: z.string().min(1, 'Last name is required.'),
  email: z.string().email('Must be a valid corporate email address.'),
  role: z.enum(['manager', 'employee'], { message: "Role must be 'manager' or 'employee'." }),
  branch_id: z.string().or(z.number()),
});

export const CreateTrainingSchema = z.object({
  title: z.string().min(1, 'Training title is required.'),
  description: z.string().optional(),
  scheduled_start: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'scheduled_start must be a valid ISO Date string.',
  }),
  scheduled_end: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'scheduled_end must be a valid ISO Date string.',
  }),
  target_branch_ids: z.array(z.number().or(z.string())).optional(),
  training_type: z.enum(['online', 'offline']).default('online'),
});

export const UpdateTrainingSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  scheduled_start: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'scheduled_start must be a valid ISO Date string.',
  }).optional(),
  scheduled_end: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'scheduled_end must be a valid ISO Date string.',
  }).optional(),
  status: z.enum(['scheduled', 'rescheduled', 'cancelled']).optional(),
  training_type: z.enum(['online', 'offline']).optional(),
});

export const AttendanceItemSchema = z.object({
  employee_id: z.string().or(z.number()),
  status: z.enum(['attended', 'absent', 'excused', 'pending']),
});

export const SubmitAttendanceSchema = z.object({
  attendance: z.array(AttendanceItemSchema).min(1, 'Attendance list cannot be empty.'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required.'),
  description: z.string().optional(),
  due_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'due_date must be a valid ISO Date string.',
  }).optional(),
});

export const CompleteTaskSchema = z.object({
  is_completed: z.boolean({ message: 'is_completed state is required.' }),
});
