// รายการรถ (ทุกคนที่ล็อกอินดูได้)
const express = require('express');
const pool = require('../config/db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, plate_number, brand, model, car_type, seats, image_url, status
         FROM cars ORDER BY status, brand, model, id`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
