// การเชื่อมต่อฐานข้อมูล MySQL (ใช้ connection pool)
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ku_car_booking',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  // ให้ DATETIME กลับมาเป็นสตริง "YYYY-MM-DD HH:mm:ss" ตรง ๆ (ไม่ถูกแปลง timezone)
  dateStrings: true
});

module.exports = pool;
