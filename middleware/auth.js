// Middleware ตรวจสิทธิ์การเข้าใช้งาน (Authentication & Authorization)
// - requireLogin : ต้องล็อกอินแล้ว
// - requireUser  : ต้องเป็นผู้จองทั่วไป (role = user)
// - requireAdmin : ต้องเป็นผู้ดูแลระบบ (role = admin)
// ถ้าเป็นการเรียก API (/api/...) จะตอบ JSON + status code, ถ้าเป็นหน้าเว็บจะ redirect

const isApi = (req) => req.originalUrl.startsWith('/api/');

function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  if (isApi(req)) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อน' });
  return res.redirect('/login');
}

function requireUser(req, res, next) {
  if (!req.session || !req.session.user) {
    if (isApi(req)) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อน' });
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'user') {
    if (isApi(req)) return res.status(403).json({ message: 'ผู้ดูแลระบบไม่มีสิทธิ์จองรถ' });
    return res.redirect('/admin');
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    if (isApi(req)) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อน' });
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'admin') {
    if (isApi(req)) return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแลระบบ' });
    return res.status(403).send(forbiddenPage());
  }
  return next();
}

function forbiddenPage() {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>403 ไม่มีสิทธิ์เข้าถึง</title>
<style>body{font-family:sans-serif;background:#faf8f1;display:grid;place-items:center;height:100vh;margin:0;color:#1f2d2c}
.box{text-align:center;padding:2rem 3rem;background:#fff;border-radius:16px;border:1px solid #e4e0d2}
h1{color:#006664;margin:0 0 .5rem}a{color:#006664}</style></head>
<body><div class="box"><h1>403</h1><p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะผู้ดูแลระบบ)</p><a href="/">กลับหน้าหลัก</a></div></body></html>`;
}

module.exports = { requireLogin, requireUser, requireAdmin };
