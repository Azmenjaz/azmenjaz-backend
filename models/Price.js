const pool = require('../config/database');

class Price {
  static async save(route, travelDate, price, airline = null) {
    const query = `
      INSERT INTO price_history (route, travel_date, price, airline, recorded_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [route, travelDate, price, airline]);
    return result.rows[0];
  }

  static async getHistory(route, travelDate, limit = 10) {
    const query = `
      SELECT * FROM price_history
      WHERE route = $1 AND travel_date = $2
      ORDER BY recorded_at DESC
      LIMIT $3
    `;
    const result = await pool.query(query, [route, travelDate, limit]);
    return result.rows;
  }

  static async getLatest(route, travelDate) {
    const query = `
      SELECT * FROM price_history
      WHERE route = $1 AND travel_date = $2
      ORDER BY recorded_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [route, travelDate]);
    return result.rows[0];
  }

  static async getAverage(route, travelDate) {
    const query = `
      SELECT AVG(price) as avg_price
      FROM price_history
      WHERE route = $1 AND travel_date = $2
    `;
    const result = await pool.query(query, [route, travelDate]);
    return result.rows[0]?.avg_price || null;
  }
}

module.exports = Price;
