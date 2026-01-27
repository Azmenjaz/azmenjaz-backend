const pool = require('../config/database');

class User {
  static async create(name, phone, email = null) {
    try {
      const query = `
        INSERT INTO users (name, phone, email, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;
      const result = await pool.query(query, [name, phone, email]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('رقم الجوال مسجل مسبقاً');
      }
      throw error;
    }
  }

  static async findByPhone(phone) {
    const query = 'SELECT * FROM users WHERE phone = $1';
    const result = await pool.query(query, [phone]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async getAll() {
    const query = 'SELECT id, name, phone, created_at FROM users ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = User;
