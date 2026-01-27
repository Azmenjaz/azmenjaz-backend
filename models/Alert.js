const pool = require('../config/database');

class Alert {
  static async create(userId, fromCity, toCity, travelDate, targetPrice = null) {
    const query = `
      INSERT INTO alerts (user_id, from_city, to_city, travel_date, target_price, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [userId, fromCity, toCity, travelDate, targetPrice]);
    return result.rows[0];
  }

  static async getByUserId(userId) {
    const query = `
      SELECT * FROM alerts
      WHERE user_id = $1 AND is_active = TRUE
      ORDER BY travel_date ASC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  static async getActive() {
    const query = `
      SELECT a.*, u.name, u.phone, u.email
      FROM alerts a
      JOIN users u ON a.user_id = u.id
      WHERE a.is_active = TRUE AND a.travel_date >= CURRENT_DATE
      ORDER BY a.travel_date ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  static async deactivate(alertId) {
    const query = 'UPDATE alerts SET is_active = FALSE WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [alertId]);
    return result.rows[0];
  }

  static async delete(alertId) {
    const query = 'DELETE FROM alerts WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [alertId]);
    return result.rows[0];
  }
}

module.exports = Alert;