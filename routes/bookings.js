// เส้นทางการจองสำหรับผู้ใช้ทั่วไป
const express = require('express');
const pool = require('../config/db');
const { requireLogin, requireUser } = require('../middleware/auth');
const svc = require('../services/bookingService');

const router = express.Router();

// ปฏิทิน: การจองทั้งหมดที่ครองช่วงเวลาอยู่ (pending/approved)
// ผู้ใช้เห็นเพียง "รถ + ช่วงเวลา + สถานะ" ของคนอื่น (ไม่เห็นชื่อ/วัตถุประสงค์) แต่เห็นรายละเอียดของรายการตัวเอง
router.get('/calendar', requireLogin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.car_id, b.user_id, b.start_datetime, b.end_datetime, b.status,
              b.pickup_location, b.dropoff_location,
              c.plate_number, c.brand, c.model
         FROM bookings b
         JOIN cars c ON c.id = b.car_id
        WHERE b.status IN ('pending','approved')
        ORDER BY b.start_datetime`
    );
    const me = req.session.user;
    res.json(rows.map((r) => {
      const mine = r.user_id === me.id;
      return {
        id: r.id,
        car_id: r.car_id,
        plate_number: r.plate_number,
        car_name: `${r.brand} ${r.model}`,
        start: r.start_datetime.replace(' ', 'T'),
        end: r.end_datetime.replace(' ', 'T'),
        status: r.status,
        mine,
        pickup_location: mine ? r.pickup_location : null,
        dropoff_location: mine ? r.dropoff_location : null
      };
    }));
  } catch (err) { next(err); }
});

// ตรวจว่ารถว่างหรือไม่ (เรียกจากหน้าจองเพื่อแจ้งเตือนทันทีก่อนกดส่ง)
router.get('/check', requireUser, async (req, res, next) => {
  try {
    const result = await svc.checkAvailability(Number(req.query.car_id), req.query.start, req.query.end);
    res.json(result);
  } catch (err) { next(err); }
});

// การจองของฉัน
router.get('/mine', requireUser, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.start_datetime, b.end_datetime, b.pickup_location, b.dropoff_location,
              b.purpose, b.passengers, b.status, b.admin_note, b.created_at,
              c.plate_number, c.brand, c.model, c.image_url
         FROM bookings b
         JOIN cars c ON c.id = b.car_id
        WHERE b.user_id = ?
        ORDER BY b.start_datetime DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ส่งคำขอจอง (สถานะเริ่มต้น = pending รอผู้ดูแลอนุมัติ)
router.post('/', requireUser, async (req, res, next) => {
  try {
    const id = await svc.createBooking(req.session.user.id, req.body);
    res.status(201).json({ id, message: 'ส่งคำขอจองเรียบร้อย รอผู้ดูแลระบบอนุมัติ' });
  } catch (err) { next(err); }
});

// ยกเลิกการจองของตัวเอง (เฉพาะรายการที่ยังไม่เริ่ม และยังเป็น pending/approved)
router.post('/:id/cancel', requireUser, async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE bookings SET status = 'cancelled'
        WHERE id = ? AND user_id = ? AND status IN ('pending','approved') AND start_datetime > ?`,
      [Number(req.params.id), req.session.user.id, svc.nowBangkok()]
    );
    if (!result.affectedRows)
      return res.status(409).json({ message: 'ไม่สามารถยกเลิกรายการนี้ได้ (อาจเริ่มไปแล้ว หรือถูกดำเนินการแล้ว)' });
    res.json({ message: 'ยกเลิกการจองเรียบร้อย' });
  } catch (err) { next(err); }
});

module.exports = router;
