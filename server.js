// ระบบจองรถยนต์ของมหาวิทยาลัยเกษตรศาสตร์ - จุดเริ่มต้นของ Backend (Express)
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pool = require('./config/db');
const { seedIfEmpty } = require('./config/seed');
const { requireLogin, requireUser, requireAdmin } = require('./middleware/auth');
const { BookingError } = require('./services/bookingService');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const view = (name) => path.join(__dirname, 'views', name);

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'ku.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 } // 8 ชั่วโมง
}));

// ไฟล์สาธารณะ: css / js / รูปภาพ (ไม่มีหน้า HTML ใด ๆ อยู่ในโฟลเดอร์นี้)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- หน้าเว็บ (HTML อยู่ในโฟลเดอร์ views และถูกป้องกันด้วย middleware) ----------
const noCache = (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
app.use(noCache);

const redirectIfLoggedIn = (req, res, next) => {
  const u = req.session.user;
  if (u) return res.redirect(u.role === 'admin' ? '/admin' : '/');
  next();
};

app.get('/login', redirectIfLoggedIn, (req, res) => res.sendFile(view('login.html')));
app.get('/register', redirectIfLoggedIn, (req, res) => res.sendFile(view('register.html')));

app.get('/', requireUser, (req, res) => res.sendFile(view('index.html')));              // Dashboard + ปฏิทิน (User)
app.get('/book', requireUser, (req, res) => res.sendFile(view('book.html')));           // ฟอร์มจองรถ (User)
app.get('/my-bookings', requireUser, (req, res) => res.sendFile(view('my-bookings.html'))); // ประวัติการจอง (User)
app.get('/admin', requireAdmin, (req, res) => res.sendFile(view('admin.html')));        // Admin Dashboard (Admin เท่านั้น)

// ---------- API ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cars', require('./routes/cars'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ message: 'ไม่พบเส้นทางที่เรียก' }));
app.use((req, res) => res.status(404).send('ไม่พบหน้าที่ต้องการ (404)'));

// ---------- จัดการ Error ----------
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง' });
  }
  if (err instanceof BookingError) {
    return res.status(err.status).json({ message: err.message, ...err.extra });
  }
  console.error(err);
  res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' });
});

// ---------- เริ่มเซิร์ฟเวอร์ ----------
(async () => {
  try {
    await pool.query('SELECT 1');
    if (await seedIfEmpty()) {
      console.log('สร้างบัญชีตัวอย่างแล้ว -> admin / admin1234  และ  user / user1234');
    }
    app.listen(PORT, () => {
      console.log(`✅ ระบบจองรถ ม.เกษตรศาสตร์ พร้อมใช้งานที่ http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ เชื่อมต่อฐานข้อมูลไม่สำเร็จ:', err.code || '', err.message);
    console.error('   ตรวจสอบว่าเปิด MySQL แล้ว, สร้างฐานข้อมูลแล้ว (npm run db:init) และตั้งค่าไฟล์ .env ถูกต้อง');
    process.exit(1);
  }
})();
