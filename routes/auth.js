// เส้นทางสมัครสมาชิก / เข้าสู่ระบบ / ออกจากระบบ
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const router = express.Router();

// จำกัดการเดารหัสผ่าน: ผิดเกิน 8 ครั้งใน 15 นาที (ต่อ IP+username) ให้รอก่อน
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
function tooManyAttempts(key) {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) { attempts.delete(key); return false; }
  return rec.count >= MAX_ATTEMPTS;
}
function recordFailure(key) {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else rec.count += 1;
}

const publicUser = (u) => ({
  id: u.id, username: u.username, full_name: u.full_name, department: u.department, phone: u.phone, role: u.role
});

// สมัครสมาชิก: สร้างได้เฉพาะ role = user เท่านั้น (ไม่มีทางสมัครเป็น admin ผ่านหน้าเว็บ)
router.post('/register', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const fullName = String(req.body.full_name || '').trim();
    const department = String(req.body.department || '').trim() || null;
    const phone = String(req.body.phone || '').trim() || null;

    if (!/^[A-Za-z0-9_.]{4,30}$/.test(username))
      return res.status(400).json({ message: 'ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 4-30 ตัว' });
    if (password.length < 6)
      return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    if (!fullName)
      return res.status(400).json({ message: 'กรุณากรอกชื่อ-นามสกุล' });
    if (phone && !/^[0-9+\-\s]{8,20}$/.test(phone))
      return res.status(400).json({ message: 'เบอร์โทรศัพท์ไม่ถูกต้อง' });

    const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length) return res.status(409).json({ message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (username, password_hash, full_name, department, phone, role) VALUES (?, ?, ?, ?, ?, 'user')",
      [username, hash, fullName, department, phone]
    );
    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ' });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const key = `${req.ip}|${username.toLowerCase()}`;

    if (tooManyAttempts(key))
      return res.status(429).json({ message: 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' });

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) {
      recordFailure(key);
      return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    attempts.delete(key);

    // สร้าง session ใหม่ทุกครั้งที่ล็อกอิน (ป้องกัน session fixation)
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = publicUser(user);
      req.session.save((err2) => {
        if (err2) return next(err2);
        res.json({ user: req.session.user, redirect: user.role === 'admin' ? '/admin' : '/' });
      });
    });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('ku.sid');
    res.json({ message: 'ออกจากระบบแล้ว' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'ยังไม่ได้เข้าสู่ระบบ' });
  res.json({ user: req.session.user });
});

module.exports = router;
