// สร้างฐานข้อมูลและตารางจากไฟล์ database/schema.sql  ->  รันด้วย: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      charset: 'utf8mb4',
      multipleStatements: true
    });
    await conn.query(sql);
    console.log('✅ สร้างฐานข้อมูล ku_car_booking และตารางทั้งหมดเรียบร้อย');
    console.log('   ต่อไปรัน: npm start');
  } catch (err) {
    console.error('❌ สร้างฐานข้อมูลไม่สำเร็จ:', err.code || '', err.message);
    console.error('   ตรวจสอบว่าเปิด MySQL (XAMPP > Start MySQL) และค่าใน .env ถูกต้อง');
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
