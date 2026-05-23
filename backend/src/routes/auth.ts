import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'AxisSuperSecureBrandSecret2026Key!';

// POST /api/v1/auth/login
// Supports logging in with either email or unique employee ID (e.g. EMP_PRIME_01 or MGR_PRIME)
router.post('/login', async (req: Request, res: Response) => {
  const { email_or_id, password } = req.body;

  if (!email_or_id || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Please provide both email_or_id and password.' 
    });
  }

  try {
    // Query matching either email or employee_id
    const userRes = await db.query(
      `SELECT e.*, b.name AS branch_name, b.branch_code 
       FROM employees e
       LEFT JOIN branches b ON e.branch_id = b.id
       WHERE e.email = $1 OR e.employee_id = $1`,
      [email_or_id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid login credentials.' });
    }

    const user = userRes.rows[0];

    // Verify bcrypt password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid login credentials.' });
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

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    // Respond with payload envelope
    return res.status(200).json({
      success: true,
      data: {
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
          }
        }
      },
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (err: any) {
    console.error('Error logging in employee:', err);
    return res.status(500).json({ success: false, error: 'Internal server login error.' });
  }
});

// Import middleware for secure registration
import { authenticateToken, requireManager, AuthenticatedRequest } from '../middleware/auth';

// POST /api/v1/auth/register (Manager restricted)
// Allows managers to dynamically register new standard employees or other managers in the DB
router.post('/register', authenticateToken as any, requireManager as any, async (req: AuthenticatedRequest, res: Response) => {
  const { employee_id, first_name, last_name, email, role, branch_id } = req.body;

  if (!employee_id || !first_name || !last_name || !email || !role || !branch_id) {
    return res.status(400).json({ success: false, error: 'All fields are required to register a new employee.' });
  }

  try {
    const passwordHash = await bcrypt.hash('Password123', 10); // Standard corporate default password

    const userRes = await db.query(
      `INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, employee_id, first_name, last_name, email, role, branch_id`,
      [employee_id, first_name, last_name, email, passwordHash, role, branch_id]
    );

    return res.status(201).json({
      success: true,
      message: 'New employee registered successfully in Axis Bank Active Directory.',
      data: userRes.rows[0]
    });
  } catch (err: any) {
    console.error('Error registering new employee:', err);
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Employee ID or Corporate Email already exists in the system.' });
    }
    return res.status(500).json({ success: false, error: 'Internal server registration error.' });
  }
});

export default router;
