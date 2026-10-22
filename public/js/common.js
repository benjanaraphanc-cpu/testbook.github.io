// ฟังก์ชันที่ใช้ร่วมกันทุกหน้า: เรียก API, วันที่ภาษาไทย, Navbar, Toast
(function () {
  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const STATUS = {
    pending: { text: 'รออนุมัติ', cls: 'st-pending', icon: 'bi-hourglass-split' },
    approved: { text: 'อนุมัติแล้ว', cls: 'st-approved', icon: 'bi-check-circle-fill' },
    rejected: { text: 'ไม่อนุมัติ', cls: 'st-rejected', icon: 'bi-x-circle-fill' },
    cancelled: { text: 'ยกเลิก', cls: 'st-cancelled', icon: 'bi-slash-circle' }
  };

  // ป้องกัน XSS: ครอบข้อความจากผู้ใช้ทุกครั้งก่อนใส่ลง innerHTML
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function api(url, options = {}) {
    const init = { credentials: 'same-origin', headers: {}, method: options.method || 'GET' };
    if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    let res;
    try { res = await fetch(url, init); }
    catch (e) { throw Object.assign(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่'), { status: 0 }); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* ไม่มี body */ }
    if (res.status === 401 && !options.noRedirect) { location.href = '/login'; throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'), { status: 401 }); }
    if (!res.ok) throw Object.assign(new Error((data && data.message) || 'เกิดข้อผิดพลาด'), { status: res.status, data });
    return data;
  }

  const pad = (n) => String(n).padStart(2, '0');
  function parts(s) {
    const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    return m ? { y: +m[1], mo: +m[2], d: +m[3], h: m[4], mi: m[5] } : null;
  }
  function fmtDate(s) { const p = parts(s); return p ? `${p.d} ${MONTHS[p.mo - 1]} ${p.y + 543}` : '-'; }
  function fmtTime(s) { const p = parts(s); return p ? `${p.h}:${p.mi}` : '-'; }
  function fmtDT(s) { const p = parts(s); return p ? `${fmtDate(s)} ${p.h}:${p.mi} น.` : '-'; }
  function fmtRange(a, b) {
    const pa = parts(a), pb = parts(b);
    if (!pa || !pb) return '-';
    if (pa.y === pb.y && pa.mo === pb.mo && pa.d === pb.d) return `${fmtDate(a)} ${pa.h}:${pa.mi} - ${pb.h}:${pb.mi} น.`;
    return `${fmtDT(a)} ถึง ${fmtDT(b)}`;
  }
  // "YYYY-MM-DDTHH:mm" ตามเวลาเครื่อง สำหรับ <input type="datetime-local">
  function localInputValue(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function statusBadge(status) {
    const s = STATUS[status] || { text: status, cls: 'st-cancelled', icon: 'bi-question-circle' };
    return `<span class="badge-status ${s.cls}"><i class="bi ${s.icon} me-1"></i>${s.text}</span>`;
  }

  function toast(message, type = 'success') {
    let box = document.getElementById('toastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBox';
      box.className = 'toast-container position-fixed top-0 end-0 p-3';
      box.style.zIndex = 2000;
      document.body.appendChild(box);
    }
    const colors = { success: 'text-bg-success', danger: 'text-bg-danger', warning: 'text-bg-warning', info: 'text-bg-info' };
    const icons = { success: 'bi-check-circle-fill', danger: 'bi-exclamation-triangle-fill', warning: 'bi-exclamation-circle-fill', info: 'bi-info-circle-fill' };
    const el = document.createElement('div');
    el.className = `toast align-items-center border-0 ${colors[type] || colors.info}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi ${icons[type] || icons.info} me-2"></i>${esc(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    box.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: type === 'danger' ? 6000 : 3500 });
    el.addEventListener('hidden.bs.toast', () => el.remove());
    t.show();
  }

  function carImage(url) { return esc(url || '/images/cars/sedan.svg'); }

  // ตรวจสิทธิ์ฝั่งหน้าเว็บ + วาด Navbar  (ฝั่งเซิร์ฟเวอร์ตรวจสิทธิ์จริงอีกชั้นเสมอ)
  async function initPage(active, requiredRole) {
    const { user } = await api('/api/auth/me');
    if (requiredRole && user.role !== requiredRole) { location.href = user.role === 'admin' ? '/admin' : '/'; return new Promise(() => {}); }
    const links = user.role === 'admin'
      ? [{ href: '/admin', key: 'admin', icon: 'bi-speedometer2', text: 'Admin Dashboard' }]
      : [{ href: '/', key: 'home', icon: 'bi-calendar3', text: 'ปฏิทินการจอง' },
         { href: '/book', key: 'book', icon: 'bi-car-front-fill', text: 'จองรถ' },
         { href: '/my-bookings', key: 'mine', icon: 'bi-list-check', text: 'การจองของฉัน' }];
    const nav = document.getElementById('navbar');
    if (nav) {
      nav.innerHTML = `
      <nav class="navbar navbar-expand-lg ku-navbar sticky-top">
        <div class="container">
          <a class="navbar-brand d-flex align-items-center" href="${user.role === 'admin' ? '/admin' : '/'}">
            <span class="ku-logo">KU</span><span>ระบบจองรถ <span class="d-none d-sm-inline">มหาวิทยาลัยเกษตรศาสตร์</span></span>
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu"><span class="navbar-toggler-icon"></span></button>
          <div class="collapse navbar-collapse" id="navMenu">
            <ul class="navbar-nav me-auto mt-2 mt-lg-0">
              ${links.map((l) => `<li class="nav-item"><a class="nav-link ${l.key === active ? 'active' : ''}" href="${l.href}"><i class="bi ${l.icon} me-1"></i>${l.text}</a></li>`).join('')}
            </ul>
            <div class="d-flex align-items-center gap-3 mt-2 mt-lg-0">
              <div class="ku-user text-lg-end"><div><i class="bi bi-person-circle me-1"></i>${esc(user.full_name)}</div>
                <small>${user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้จอง'}</small></div>
              <button class="btn btn-sm btn-light" id="btnLogout"><i class="bi bi-box-arrow-right me-1"></i>ออกจากระบบ</button>
            </div>
          </div>
        </div>
      </nav>`;
      document.getElementById('btnLogout').addEventListener('click', async () => {
        try { await api('/api/auth/logout', { method: 'POST', body: {} }); } finally { location.href = '/login'; }
      });
    }
    return user;
  }

  window.KU = { api, esc, fmtDate, fmtTime, fmtDT, fmtRange, localInputValue, statusBadge, toast, initPage, carImage };
})();
