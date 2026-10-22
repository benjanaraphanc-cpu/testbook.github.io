// ตรรกะธุรกิจของการจอง: ตรวจเวลา + ป้องกันการจองซ้ำ
const pool = require('../config/db');

// สถานะที่ "ครองช่วงเวลา" ของรถ (ห้ามมีการจองอื่นทับ)
const BLOCKING_STATUSES = ['pending', 'approved'];

class BookingError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// เวลาปัจจุบันตามเวลาประเทศไทย รูปแบบ "YYYY-MM-DD HH:mm:ss" (เทียบเป็นสตริงได้เลย)
function nowBangkok() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(new Date()).replace('T', ' ');
}

// รับ "2026-10-25T09:30" หรือ "2026-10-25 09:30" -> "2026-10-25 09:30:00" (ถ้ารูปแบบผิดคืน null)
function normalizeDateTime(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const normalized = `${m[1]} ${m[2]}:${m[3] || '00'}`;
  const d = new Date(normalized.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 19).replace('T', ' ') !== normalized) return null;
  return normalized;
}

// ค้นหาการจองที่ "ทับซ้อนเวลา" กับช่วง [start, end) ของรถคันนี้
// เงื่อนไขทับซ้อน: เริ่มใหม่ < จบเดิม  และ  จบใหม่ > เริ่มเดิม
// (จองต่อกันพอดี เช่น เดิมจบ 12:00 ใหม่เริ่ม 12:00 ถือว่าไม่ซ้ำ)
async function findConflict(db, carId, start, end, excludeBookingId = null, statuses = BLOCKING_STATUSES) {
  const placeholders = statuses.map(() => '?').join(',');
  let sql = `SELECT id, start_datetime, end_datetime, status
               FROM bookings
              WHERE car_id = ?
                AND status IN (${placeholders})
                AND start_datetime < ?
                AND end_datetime > ?`;
  const params = [carId, ...statuses, end, start];
  if (excludeBookingId) {
    sql += ' AND id <> ?';
    params.push(excludeBookingId);
  }
  sql += ' ORDER BY start_datetime LIMIT 1';
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

const fmtThai = (dt) => dt.slice(0, 16).replace(' ', ' เวลา ');

function conflictMessage(conflict) {
  const who = conflict.status === 'approved' ? 'ได้รับการอนุมัติแล้ว' : 'ถูกจองไว้ (รออนุมัติ)';
  return `รถคันนี้${who}ในช่วงเวลา ${fmtThai(conflict.start_datetime)} ถึง ${fmtThai(conflict.end_datetime)} กรุณาเลือกเวลาหรือรถคันอื่น`;
}

function validateRange(start, end) {
  if (!start || !end) throw new BookingError('รูปแบบวันและเวลาไม่ถูกต้อง');
  if (end <= start) throw new BookingError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
  if (start < nowBangkok()) throw new BookingError('ไม่สามารถจองย้อนหลังได้ กรุณาเลือกเวลาในอนาคต');
}

// ตรวจสอบเบื้องต้นว่าช่วงเวลานี้ว่างหรือไม่ (ใช้ในหน้าจองเพื่อแจ้งเตือนทันที)
async function checkAvailability(carId, startRaw, endRaw) {
  if (!Number.isInteger(carId) || carId <= 0) throw new BookingError('กรุณาเลือกรถ');
  const start = normalizeDateTime(startRaw);
  const end = normalizeDateTime(endRaw);
  validateRange(start, end);
  const [cars] = await pool.query('SELECT id, status FROM cars WHERE id = ?', [carId]);
  if (!cars.length) throw new BookingError('ไม่พบรถคันที่เลือก', 404);
  if (cars[0].status !== 'available') throw new BookingError('รถคันนี้อยู่ระหว่างซ่อมบำรุง ไม่สามารถจองได้', 409);
  const conflict = await findConflict(pool, carId, start, end);
  return conflict
    ? { available: false, message: conflictMessage(conflict), conflict }
    : { available: true, message: 'รถคันนี้ว่างในช่วงเวลาที่เลือก' };
}

// สร้างการจอง: ใช้ transaction + ล็อกแถวรถ (SELECT ... FOR UPDATE)
// เพื่อกันกรณีสองคนกดจองรถคันเดียวกันพร้อมกัน
async function createBooking(userId, data) {
  const start = normalizeDateTime(data.start);
  const end = normalizeDateTime(data.end);
  validateRange(start, end);

  const carId = Number(data.car_id);
  const pickup = String(data.pickup_location || '').trim();
  const dropoff = String(data.dropoff_location || '').trim();
  const purpose = String(data.purpose || '').trim();
  const passengers = Number(data.passengers);

  if (!Number.isInteger(carId) || carId <= 0) throw new BookingError('กรุณาเลือกรถ');
  if (!pickup) throw new BookingError('กรุณาระบุจุดหมายรับ');
  if (!dropoff) throw new BookingError('กรุณาระบุจุดหมายส่ง');
  if (!purpose) throw new BookingError('กรุณาระบุวัตถุประสงค์การเดินทาง');
  if (pickup.length > 200 || dropoff.length > 200 || purpose.length > 255) throw new BookingError('ข้อความยาวเกินไป');
  if (!Number.isInteger(passengers) || passengers < 1) throw new BookingError('จำนวนผู้โดยสารไม่ถูกต้อง');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [cars] = await conn.query('SELECT id, seats, status FROM cars WHERE id = ? FOR UPDATE', [carId]);
    if (!cars.length) throw new BookingError('ไม่พบรถคันที่เลือก', 404);
    if (cars[0].status !== 'available') throw new BookingError('รถคันนี้อยู่ระหว่างซ่อมบำรุง ไม่สามารถจองได้', 409);
    if (passengers > cars[0].seats) throw new BookingError(`รถคันนี้นั่งได้สูงสุด ${cars[0].seats} คน`);

    const conflict = await findConflict(conn, carId, start, end);
    if (conflict) throw new BookingError(conflictMessage(conflict), 409, { conflict });

    const [result] = await conn.query(
      `INSERT INTO bookings
         (user_id, car_id, start_datetime, end_datetime, pickup_location, dropoff_location, purpose, passengers, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, carId, start, end, pickup, dropoff, purpose, passengers]
    );
    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// อนุมัติ/ไม่อนุมัติ (Admin): ทำได้เฉพาะรายการที่ยังเป็น pending
async function reviewBooking(bookingId, adminId, decision, note) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
    if (!rows.length) throw new BookingError('ไม่พบรายการจองนี้', 404);
    const booking = rows[0];
    if (booking.status !== 'pending') throw new BookingError('รายการนี้ถูกดำเนินการไปแล้ว', 409);

    if (decision === 'approved') {
      // ล็อกรถ แล้วตรวจซ้ำกับรายการที่อนุมัติแล้ว (กันพลาดอีกชั้น)
      await conn.query('SELECT id FROM cars WHERE id = ? FOR UPDATE', [booking.car_id]);
      const conflict = await findConflict(conn, booking.car_id, booking.start_datetime, booking.end_datetime, booking.id, ['approved']);
      if (conflict) throw new BookingError(conflictMessage(conflict), 409, { conflict });
    }

    await conn.query(
      `UPDATE bookings
          SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ?`,
      [decision, note || null, adminId, nowBangkok(), bookingId]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  BookingError,
  nowBangkok,
  normalizeDateTime,
  findConflict,
  checkAvailability,
  createBooking,
  reviewBooking
};
