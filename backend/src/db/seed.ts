import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import db from '../config/db';

async function seedDatabase() {
  console.log('🚀 Starting Axis Bank Database Seeding Process (1,100 Sample Users Target)...');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Load and execute schema.sql from root workspace to initialize the tables
    console.log('📋 Initializing Database Tables from schema.sql...');
    const schemaPath = path.resolve(__dirname, '../../../schema.sql');
    if (fs.existsSync(schemaPath)) {
      // Safely drop existing tables & types to allow clean, conflict-free re-seeding
      await client.query(`
        DROP TABLE IF EXISTS attendee_tasks CASCADE;
        DROP TABLE IF EXISTS tasks CASCADE;
        DROP TABLE IF EXISTS training_attendees CASCADE;
        DROP TABLE IF EXISTS trainings CASCADE;
        DROP TABLE IF EXISTS employees CASCADE;
        DROP TABLE IF EXISTS branches CASCADE;
        DROP TYPE IF EXISTS user_role CASCADE;
        DROP TYPE IF EXISTS training_status CASCADE;
        DROP TYPE IF EXISTS attendance_status CASCADE;
      `);
      
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('✅ Tables created/initialized successfully.');
    } else {
      console.log('⚠️ schema.sql not found at absolute path, skipping DDL execution.');
    }

    // 2. Seed Branches
    console.log('🏢 Seeding Axis Bank Branches...');
    const branches = [
      { code: 'AXIS0001', name: 'Mumbai Corporate Office', city: 'Mumbai', lat: 18.9219, lng: 72.8336 },
      { code: 'AXIS0002', name: 'Gigaplex Navi Mumbai Branch', city: 'Navi Mumbai', lat: 19.1176, lng: 73.0158 },
      { code: 'AXIS0003', name: 'Connaught Place Branch', city: 'Delhi', lat: 28.6289, lng: 77.2173 },
      { code: 'AXIS0004', name: 'Indiranagar Wealth Management', city: 'Bangalore', lat: 12.9784, lng: 77.6408 },
      { code: 'AXIS0005', name: 'Gachibowli Tech Hub Branch', city: 'Hyderabad', lat: 17.4483, lng: 78.3741 },
      { code: 'AXIS0006', name: 'Axis Global Towers', city: 'Pune', lat: 18.5479, lng: 73.7728 },
    ];

    const branchIds: string[] = [];
    for (const b of branches) {
      const res = await client.query(
        `INSERT INTO branches (branch_code, name, city, latitude, longitude) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (branch_code) DO UPDATE SET name = $2, city = $3, latitude = $4, longitude = $5
         RETURNING id`,
        [b.code, b.name, b.city, b.lat, b.lng]
      );
      branchIds.push(res.rows[0].id);
    }
    console.log(`✅ Seeded ${branchIds.length} branches.`);

    // 3. Seed 1,100 Employees
    console.log('👥 Generating 1,100 sample users with strict structural hierarchy...');
    const passwordHash = await bcrypt.hash('Password123', 10);
    
    const managerIds: string[] = [];
    const employeeIds: string[] = [];
    const empBranchMap: Map<string, string> = new Map(); // employee_id -> branch_id

    // Structure Requirement: "1 manager having 10 people under him"
    // Let's create this prime manager in Branch 0
    const primeManagerBranchId = branchIds[0];
    const primeManagerRes = await client.query(
      `INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, branch_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id`,
      ['MGR_PRIME', 'Rahul', 'Sharma', 'rahul.sharma@axisbank.com', passwordHash, 'manager', primeManagerBranchId]
    );
    const primeManagerId = primeManagerRes.rows[0].id;
    managerIds.push(primeManagerId);
    empBranchMap.set(primeManagerId, primeManagerBranchId);

    // Create exactly 10 employees under him, assigned to Axis Global Towers (branchIds[5] in Pune)
    const primeEmployeeBranchId = branchIds[5];
    for (let i = 1; i <= 10; i++) {
      const empId = `EMP_PRIME_${i.toString().padStart(2, '0')}`;
      const res = await client.query(
        `INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, branch_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id`,
        [empId, `PrimeEmployee`, `${i}`, `prime.emp${i}@axisbank.com`, passwordHash, 'employee', primeEmployeeBranchId]
      );
      const insertedId = res.rows[0].id;
      employeeIds.push(insertedId);
      empBranchMap.set(insertedId, primeEmployeeBranchId);
    }
    console.log('✅ Prime hierarchy initialized (1 manager in Mumbai, 10 employees in Axis Global Towers Pune).');

    // Generate remaining 1,089 users to reach exactly 1,100 total users
    // We will make 89 other Managers and 1,000 other standard Employees distributed across other branches
    const totalTarget = 1100;
    const currentGenerated = 11; // 1 Prime Mgr + 10 Prime Employees
    const remainingToGenerate = totalTarget - currentGenerated; // 1,089

    const remainingManagersTarget = 39; // 40 managers total in the database
    const remainingEmployeesTarget = remainingToGenerate - remainingManagersTarget; // 1050

    console.log(`📋 Bulk generating remaining users: ${remainingManagersTarget} Managers & ${remainingEmployeesTarget} Employees...`);

    // Bulk insert managers across branches 1, 2, 3, 4
    for (let i = 1; i <= remainingManagersTarget; i++) {
      const branchIdx = 1 + (i % 4); // Distribute among navi mumbai, delhi, bangalore, hyderabad
      const branchId = branchIds[branchIdx];
      const empId = `MGR_${i.toString().padStart(4, '0')}`;
      const res = await client.query(
        `INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, branch_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id`,
        [empId, `Manager`, `${i}`, `manager.${i}@axisbank.com`, passwordHash, 'manager', branchId]
      );
      const insertedId = res.rows[0].id;
      managerIds.push(insertedId);
      empBranchMap.set(insertedId, branchId);
    }

    // Bulk insert standard employees across branches 1, 2, 3, 4 using multi-row batch inserts for maximum speed
    const batchSize = 100;
    let employeeIndex = 1;

    while (employeeIndex <= remainingEmployeesTarget) {
      const batchRows: string[] = [];
      const batchParams: any[] = [];
      let paramCount = 1;

      const currentBatchLimit = Math.min(employeeIndex + batchSize - 1, remainingEmployeesTarget);
      
      for (let i = employeeIndex; i <= currentBatchLimit; i++) {
        const branchIdx = 1 + (i % 4);
        const branchId = branchIds[branchIdx];
        const empCode = `EMP_${i.toString().padStart(4, '0')}`;
        const first = `Employee`;
        const last = `${i}`;
        const email = `employee.${i}@axisbank.com`;

        batchRows.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6})`);
        batchParams.push(empCode, first, last, email, passwordHash, 'employee', branchId);
        paramCount += 7;
      }

      const bulkQuery = `
        INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, branch_id)
        VALUES ${batchRows.join(', ')}
        RETURNING id, branch_id
      `;

      const res = await client.query(bulkQuery, batchParams);
      for (const row of res.rows) {
        employeeIds.push(row.id);
        empBranchMap.set(row.id, row.branch_id);
      }

      employeeIndex += batchSize;
    }

    console.log(`✅ Complete user base generated successfully!`);
    console.log(`📊 Statistics: Total Database Users = ${managerIds.length + employeeIds.length} (${managerIds.length} Managers, ${employeeIds.length} Employees)`);

    // 4. Seed Trainings
    console.log('📅 Seeding Axis Bank training modules...');
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const trainingData = [
      {
        title: 'Information Security & Cyber Safeguards',
        desc: 'Mandatory information security protocols compliance course.',
        start: twoDaysAgo,
        end: new Date(twoDaysAgo.getTime() + 3 * 60 * 60 * 1000),
        status: 'scheduled',
        type: 'offline', // Offline geofence test!
        mgrId: primeManagerId, // Prime manager handles cyber safeguards
      },
      {
        title: 'Retail Credit Risk & Underwriting',
        desc: 'Advanced models for credit scoring and underwriting checks.',
        start: yesterday,
        end: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000),
        status: 'scheduled',
        type: 'online', // Online standard bypass test!
        mgrId: primeManagerId,
      },
      {
        title: 'Axis Privilege Customer HNWI Advising',
        desc: 'Wealth products portfolios consulting and guidelines.',
        start: tomorrow,
        end: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
        status: 'scheduled',
        type: 'online',
        mgrId: managerIds[1],
      },
      {
        title: 'Digital Banking Integration Updates (Rescheduled)',
        desc: 'Postponed to accommodate system testing calendars.',
        start: nextWeek,
        end: new Date(nextWeek.getTime() + 2.5 * 60 * 60 * 1000),
        status: 'rescheduled',
        type: 'offline',
        mgrId: managerIds[1],
        originalStart: tomorrow,
      },
      {
        title: 'Legacy Mainframe Settlement Procedures',
        desc: 'System maintenance workshop. Cancelled due to upgrade cycle.',
        start: yesterday,
        end: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000),
        status: 'cancelled',
        type: 'offline',
        mgrId: primeManagerId,
        cancelReason: 'Corporate decisions migrated operations onto cloud infrastructure.',
      },
    ];

    const trainingIds: string[] = [];
    for (const t of trainingData) {
      const res = await client.query(
        `INSERT INTO trainings (title, description, scheduled_start, scheduled_end, status, manager_id, original_start_time, cancelled_reason, training_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id`,
        [t.title, t.desc, t.start, t.end, t.status, t.mgrId, t.originalStart || null, t.cancelReason || null, t.type]
      );
      trainingIds.push(res.rows[0].id);
    }
    console.log(`✅ Seeded ${trainingIds.length} training events.`);

    // 5. Seed Training Attendees (Enroll employees to trainings)
    console.log('🤝 Enrolling rosters into training rosters...');
    const attendeeRelations: { trainingId: string; employeeId: string; status: 'attended' | 'absent' | 'excused' | 'pending' }[] = [];

    // Enrollment logic for prime hierarchy (the 10 employees under Rahul Sharma in Branch 0)
    // Register them for InfoSec (Training 0) and Credit Risk (Training 1)
    const infosecTrainingId = trainingIds[0];
    const creditTrainingId = trainingIds[1];
    const hnwiTrainingId = trainingIds[2];
    const digiTrainingId = trainingIds[3];

    // Prime employees under prime manager (Let's register them all to have full metrics)
    const primeEmpIds = employeeIds.slice(0, 10);
    for (const empId of primeEmpIds) {
      // InfoSec: 8 attended, 2 absent
      const infosecStatus = primeEmpIds.indexOf(empId) < 8 ? 'attended' : 'absent';
      attendeeRelations.push({ trainingId: infosecTrainingId, employeeId: empId, status: infosecStatus });

      // Credit: 9 attended, 1 excused
      const creditStatus = primeEmpIds.indexOf(empId) < 9 ? 'attended' : 'excused';
      attendeeRelations.push({ trainingId: creditTrainingId, employeeId: empId, status: creditStatus });
      
      // Upcoming Digital: pending
      attendeeRelations.push({ trainingId: digiTrainingId, employeeId: empId, status: 'pending' });
    }

    // Now register massive cohorts from our remaining 1,000+ employees to create heavy reporting datasets
    for (let i = 10; i < employeeIds.length; i++) {
      const empId = employeeIds[i];
      const branchId = empBranchMap.get(empId);
      
      // Cyber safeguarding: massive company-wide training (enrolling 30% of employees randomly)
      if (i % 3 === 0) {
        const attStatus = Math.random() > 0.15 ? 'attended' : (Math.random() > 0.5 ? 'absent' : 'excused');
        attendeeRelations.push({ trainingId: infosecTrainingId, employeeId: empId, status: attStatus });
      }
      
      // Credit Risk: enrolling 15% randomly
      if (i % 7 === 0) {
        const attStatus = Math.random() > 0.2 ? 'attended' : 'absent';
        attendeeRelations.push({ trainingId: creditTrainingId, employeeId: empId, status: attStatus });
      }

      // Wealth advising (Upcoming tomorrow): Enroll employees from Branch 3 (Bangalore wealth)
      if (branchId === branchIds[3]) {
        attendeeRelations.push({ trainingId: hnwiTrainingId, employeeId: empId, status: 'pending' });
      }
    }

    console.log(`📋 Bulk executing ${attendeeRelations.length} attendee roster inserts...`);
    const attBatchSize = 100;
    let attIndex = 0;

    while (attIndex < attendeeRelations.length) {
      const batchRows: string[] = [];
      const batchParams: any[] = [];
      let paramCount = 1;

      const currentBatchLimit = Math.min(attIndex + attBatchSize - 1, attendeeRelations.length - 1);
      
      for (let i = attIndex; i <= currentBatchLimit; i++) {
        const ar = attendeeRelations[i];
        const markedAt = ar.status === 'attended' || ar.status === 'absent' || ar.status === 'excused' 
          ? new Date(twoDaysAgo.getTime() + 1 * 60 * 60 * 1000) 
          : null;

        batchRows.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3})`);
        batchParams.push(ar.trainingId, ar.employeeId, ar.status, markedAt);
        paramCount += 4;
      }

      const bulkQuery = `
        INSERT INTO training_attendees (training_id, employee_id, attendance_status, marked_at)
        VALUES ${batchRows.join(', ')}
        ON CONFLICT (training_id, employee_id) DO NOTHING
      `;

      await client.query(bulkQuery, batchParams);
      attIndex += attBatchSize;
    }
    console.log('✅ Seeding attendee roster enrollments finished.');

    // 6. Seed Tasks
    console.log('📝 Seeding Training Tasks...');
    const tasks = [
      {
        trainingId: infosecTrainingId,
        title: 'Review Axis Bank Information Security Policy v4',
        desc: 'Review guidelines on password complexity, network access restrictions, and phishing reports.',
      },
      {
        trainingId: infosecTrainingId,
        title: 'Complete LMS Compliance Assessment',
        desc: 'Score above 85% on the InfoSec compliance validation quiz.',
      },
      {
        trainingId: creditTrainingId,
        title: 'Review Case Study: retail-lending-default-risk.pdf',
        desc: 'Deconstruct default trends from retail portfolios in 2025.',
      },
      {
        trainingId: hnwiTrainingId,
        title: 'Download Premium HNW Segment Pitch Deck',
        desc: 'Memorize unique value propositions for Priority Banking deposits.',
      },
    ];

    const taskIds: string[] = [];
    const taskTrainingMap: Map<string, string> = new Map();

    for (const t of tasks) {
      const res = await client.query(
        `INSERT INTO tasks (training_id, title, description, due_date) 
         VALUES ($1, $2, $3, NOW() + INTERVAL '5 DAYS') 
         RETURNING id`,
        [t.trainingId, t.title, t.desc]
      );
      const insertedId = res.rows[0].id;
      taskIds.push(insertedId);
      taskTrainingMap.set(insertedId, t.trainingId);
    }
    console.log(`✅ Seeded ${taskIds.length} Tasks.`);

    // 7. Seed Attendee Tasks (Assignments & Completed Rates)
    console.log('✏️ Assigning and completing tasks for training attendees...');
    const attendeeTaskInsertions: { taskId: string; employeeId: string; isCompleted: boolean; completedAt: Date | null }[] = [];

    for (const taskId of taskIds) {
      const trainingId = taskTrainingMap.get(taskId);
      
      // Get all registered attendees for this specific training
      const attendeesRes = await client.query(
        `SELECT employee_id FROM training_attendees WHERE training_id = $1`,
        [trainingId]
      );
      
      for (const row of attendeesRes.rows) {
        const empId = row.employee_id;
        const isCompletedTraining = trainingId === infosecTrainingId || trainingId === creditTrainingId;
        const isCompleted = isCompletedTraining ? Math.random() > 0.35 : false; // ~65% completion rate
        const completedAt = isCompleted ? new Date(yesterday.getTime() + 30 * 60 * 1000) : null;
        
        attendeeTaskInsertions.push({ taskId, employeeId: empId, isCompleted, completedAt });
      }
    }

    console.log(`📋 Bulk executing ${attendeeTaskInsertions.length} attendee task assignments...`);
    let atIndex = 0;
    while (atIndex < attendeeTaskInsertions.length) {
      const batchRows: string[] = [];
      const batchParams: any[] = [];
      let paramCount = 1;

      const currentBatchLimit = Math.min(atIndex + attBatchSize - 1, attendeeTaskInsertions.length - 1);
      
      for (let i = atIndex; i <= currentBatchLimit; i++) {
        const at = attendeeTaskInsertions[i];
        batchRows.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3})`);
        batchParams.push(at.taskId, at.employeeId, at.isCompleted, at.completedAt);
        paramCount += 4;
      }

      const bulkQuery = `
        INSERT INTO attendee_tasks (task_id, employee_id, is_completed, completed_at)
        VALUES ${batchRows.join(', ')}
        ON CONFLICT (task_id, employee_id) DO NOTHING
      `;

      await client.query(bulkQuery, batchParams);
      atIndex += attBatchSize;
    }
    console.log('✅ Attendee task assignments populated successfully.');

    await client.query('COMMIT');
    console.log('🎉 Axis Bank database seeding pipeline finished successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Database seeding encountered critical crash error:', error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedDatabase();
