-- =====================================================================
--  ระบบจองรถยนต์ของมหาวิทยาลัยเกษตรศาสตร์ - MySQL Schema
--  วิธีใช้: เปิด phpMyAdmin > แท็บ SQL > วางทั้งไฟล์นี้ > กด "ดำเนินการ"
--  หรือรันด้วยคำสั่ง:  npm run db:init
--  หมายเหตุ: บัญชี admin / user ตัวอย่างจะถูกสร้างอัตโนมัติ (รหัสผ่านเข้ารหัส bcrypt)
--           ตอนเปิดเซิร์ฟเวอร์ครั้งแรก (ดู config/seed.js)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS ku_car_booking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ku_car_booking;

-- ลบตารางเก่า (ตามลำดับ foreign key) เพื่อให้รันซ้ำได้
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------
-- 1) ผู้ใช้งาน  (role: user = ผู้จองทั่วไป, admin = ผู้ดูแลระบบ)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  department    VARCHAR(150) NULL,
  phone         VARCHAR(20)  NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2) รถยนต์
-- ---------------------------------------------------------------------
CREATE TABLE cars (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  plate_number VARCHAR(30)  NOT NULL,
  brand        VARCHAR(60)  NOT NULL,
  model        VARCHAR(60)  NOT NULL,
  car_type     VARCHAR(40)  NOT NULL,
  seats        TINYINT UNSIGNED NOT NULL DEFAULT 4,
  image_url    VARCHAR(255) NULL,
  status       ENUM('available','maintenance') NOT NULL DEFAULT 'available',
  PRIMARY KEY (id),
  UNIQUE KEY uq_cars_plate (plate_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3) การจอง  (status: pending, approved, rejected, cancelled)
--    สถานะ pending และ approved ถือว่า "ครองช่วงเวลา" ของรถคันนั้นอยู่
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL,
  car_id           INT UNSIGNED NOT NULL,
  start_datetime   DATETIME     NOT NULL,
  end_datetime     DATETIME     NOT NULL,
  pickup_location  VARCHAR(200) NOT NULL,
  dropoff_location VARCHAR(200) NOT NULL,
  purpose          VARCHAR(255) NOT NULL,
  passengers       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status           ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  admin_note       VARCHAR(255) NULL,
  reviewed_by      INT UNSIGNED NULL,
  reviewed_at      DATETIME     NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bookings_car_time (car_id, start_datetime, end_datetime),
  KEY idx_bookings_user (user_id),
  KEY idx_bookings_status (status),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_car  FOREIGN KEY (car_id)  REFERENCES cars (id)  ON DELETE CASCADE,
  CONSTRAINT fk_bookings_admin FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- ข้อมูลรถตัวอย่าง (ภาพรถอยู่ในโฟลเดอร์ public/images/cars/)
-- ---------------------------------------------------------------------
INSERT INTO cars (plate_number, brand, model, car_type, seats, image_url, status) VALUES
  ('นก 1234 กรุงเทพมหานคร', 'Toyota', 'Camry',    'รถเก๋ง',        4,  '/images/cars/sedan.svg',   'available'),
  ('ญข 5678 กรุงเทพมหานคร', 'Honda',  'CR-V',     'รถ SUV',        5,  '/images/cars/suv.svg',     'available'),
  ('ฮค 4321 กรุงเทพมหานคร', 'Toyota', 'Commuter', 'รถตู้',         12, '/images/cars/van.svg',     'available'),
  ('กจ 8899 กรุงเทพมหานคร', 'Isuzu',  'D-Max',    'รถกระบะ',       4,  '/images/cars/pickup.svg',  'available'),
  ('ขฉ 2468 กรุงเทพมหานคร', 'Toyota', 'Fortuner', 'รถ SUV',        7,  '/images/cars/suv.svg',     'available'),
  ('ตก 1357 กรุงเทพมหานคร', 'Mitsubishi', 'Mirage', 'รถเก๋ง',      4,  '/images/cars/sedan.svg',   'maintenance');
