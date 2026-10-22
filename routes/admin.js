// เส้นทางสำหรับผู้ดูแลระบบเท่านั้น (ทุกเส้นทางผ่าน requireAdmin)
const express = require('express');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const svc = require('../services/bookingService');

const router = express.Router();
router.use(requireAdmin);

// สรุปจำนวนตามสถานะ
router.get('/stats', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT status, COUNT(*) AS total FROM bookings GROUP BY status');
    const stats = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    rows.forEach((r) => { stats[r.status] = Number(r.total); });
    res.json(stats);
  } catch (err) { next(err); }
});

// รายการจองทั้งหมด (กรองตามสถานะได้ด้วย ?status=pending)
router.get('/bookings', async (req, res, next) => {
  try {
    const allowed = ['pending', 'approved', 'rejected', 'cancelled'];
    const params = [];
    let where = '';
    if (req.query.status && allowed.includes(req.query.status)) {
      where = 'WHERE b.status = ?';
      params.push(req.query.status);
    }
    const [rows] = await pool.query(
      `SELECT b.id, b.start_datetime, b.end_datetime, b.pickup_location, b.dropoff_location,
              b.purpose, b.passengers, b.status, b.admin_note, b.created_at, b.reviewed_at,
              c.plate_number, c.brand, c.model, c.image_url,
              u.full_name, u.department, u.phone
         FROM bookings b
         JOIN cars c ON c.id = b.car_id
         JOIN users u ON u.id = b.user_id
         ${where}
        ORDER BY (b.status = 'pending') DESC, b.start_datetime DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/bookings/:id/approve', async (req, res, next) => {
  try {
    const note = String(req.body.note || '').trim().slice(0, 255);
    await svc.reviewBooking(Number(req.params.id), req.session.user.id, 'approved', note);
    res.json({ message: 'อนุมัติการจองเรียบร้อย' });
  } catch (err) { next(err); }
});

router.post('/bookings/:id/reject', async (req, res, next) => {
  try {
    const note = String(req.body.note || '').trim().slice(0, 255);
    await svc.reviewBooking(Number(req.params.id), req.session.user.id, 'rejected', note);
    res.json({ message: 'บันทึกการไม่อนุมัติเรียบร้อย' });
  } catch (err) { next(err); }
});

module.exports = router;
