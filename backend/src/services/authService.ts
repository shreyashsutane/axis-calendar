import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db';
import { env } from '../config/env';
import { AppError } from '../middleware/errors';

export class AuthService {
  private static JWT_SECRET = env.JWT_SECRET;

  public static async login(emailOrId: string, password: string) {
    // Query matching either email or employee_id
    const userRes = await db.query(
      `SELECT e.*, b.name AS branch_name, b.branch_code 
       FROM employees e
       LEFT JOIN branches b ON e.branch_id = b.id
       WHERE e.email = $1 OR e.employee_id = $1`,
      [emailOrId]
    );

    if (userRes.rows.length === 0) {
      throw new AppError('Invalid login credentials.', 401, 'INVALID_CREDENTIALS');
    }

    const user = userRes.rows[0];

    // Verify bcrypt password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid login credentials.', 401, 'INVALID_CREDENTIALS');
    }

    // Sign jwt token with essential user claims
    const tokenPayload = {
      id: user.id,
      employee_id: user.employee_id,
      role: user.role,
      branch_id: user.branch_id,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const token = jwt.sign(tokenPayload, this.JWT_SECRET, { expiresIn: '24h' });

    return {
      token,
      user: {
        id: user.id,
        employee_id: user.employee_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        branch: {
          id: user.branch_id,
          code: user.branch_code,
          name: user.branch_name,
        },
      },
    };
  }

  public static async register(
    employeeId: string,
    firstName: string,
    lastName: string,
    email: string,
    role: 'manager' | 'employee',
    branchId: string | number
  ) {
    try {
      const passwordHash = await bcrypt.hash('Password123', 10); // Standard corporate default password

      const userRes = await db.query(
        `INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, branch_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, employee_id, first_name, last_name, email, role, branch_id`,
        [employeeId, firstName, lastName, email, passwordHash, role, branchId]
      );

      return userRes.rows[0];
    } catch (err: any) {
      if (err.code === '23505') {
        throw new AppError('Employee ID or Corporate Email already exists in the system.', 409, 'EMPLOYEE_CONFLICT');
      }
      throw err;
    }
  }
}
