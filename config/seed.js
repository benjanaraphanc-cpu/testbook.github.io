// สร้างบัญชีตัวอย่าง + การจองตัวอย่าง "เฉพาะครั้งแรก" (เมื่อตาราง users ยังว่าง)
// บัญชี admin และ user ถูกเข้ารหัสรหัสผ่านด้วย bcrypt ก่อนบันทึกลงฐานข้อมูล
const bcrypt = require('bcryptjs');
const pool = require('./db');
const { nowBangkok } = require('../services/bookingService');

// บวกวันให้วันที่รูปแบบ YYYY-MM-DD
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedIfEmpty() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM users');
  if (total > 0) return false;

  const adminHash = await bcrypt.hash('admin1234', 10);
  const userHash = await bcrypt.hash('user1234', 10);

  await pool.query(
    `INSERT INTO users (username, password_hash, full_name, department, phone, role) VALUES
       ('admin', ?, 'ผู้ดูแลระบบ งานยานพาหนะ', 'กองกลาง มหาวิทยาลัยเกษตรศาสตร์', '02-000-0000', 'admin'),
       ('user',  ?, 'สมชาย ใจดี', 'คณะวิทยาศาสตร์ ภาควิชาเคมี', '081-234-5678', 'user'),
       ('somying', ?, 'สมหญิง รักเรียน', 'คณะเกษตร ภาควิชาพืชไร่นา', '089-876-5432', 'user')`,
    [adminHash, userHash, userHash]
  );

  // การจองตัวอย่าง (เทียบจากวันนี้) เพื่อให้ปฏิทินมีข้อมูลให้ดูทันที
  const today = nowBangkok().slice(0, 10);
  const [users] = await pool.query("SELECT id, username FROM users");
  const id = Object.fromEntries(users.map((u) => [u.username, u.id]));
  const rows = [
    // user_id, car_id, start, end, pickup, dropoff, purpose, passengers, status
    [id.user,    3, `${addDays(today, 1)} 08:00:00`, `${addDays(today, 1)} 16:30:00`, 'อาคารอำนวยการ บางเขน', 'ศูนย์วิจัยกำแพงแสน', 'พาคณะนิสิตลงพื้นที่ศึกษาดูงาน', 10, 'approved'],
    [id.somying, 1, `${addDays(today, 2)} 09:00:00`, `${addDays(today, 2)} 12:00:00`, 'คณะเกษตร บางเขน', 'กระทรวงเกษตรและสหกรณ์', 'ประชุมความร่วมมือทางวิชาการ', 3, 'approved'],
    [id.user,    2, `${addDays(today, 3)} 13:00:00`, `${addDays(today, 3)} 18:00:00`, 'คณะวิทยาศาสตร์ บางเขน', 'สนามบินดอนเมือง', 'รับวิทยากรรับเชิญ', 2, 'pending'],
    [id.somying, 4, `${addDays(today, 5)} 07:30:00`, `${addDays(today, 6)} 17:00:00`, 'โรงเก็บพัสดุ บางเขน', 'ศรีราชา จ.ชลบุรี', 'ขนส่งอุปกรณ์ภาคสนาม', 2, 'approved']
  ];
  for (const r of rows) {
    await pool.query(
      `INSERT INTO bookings
         (user_id, car_id, start_datetime, end_datetime, pickup_location, dropoff_location, purpose, passengers, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, r
    );
  }
  return true;
}

module.exports = { seedIfEmpty };
