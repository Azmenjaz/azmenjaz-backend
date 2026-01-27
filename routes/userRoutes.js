const express = require('express');
const router = express.Router();
const User = require('../models/User');

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    // Validation
    if (!name || !phone) {
      return res.status(400).json({ 
        success: false,
        error: 'الاسم ورقم الجوال مطلوبان' 
      });
    }

    // Check if phone is valid Saudi number
    const phoneRegex = /^(05|5)[0-9]{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({ 
        success: false,
        error: 'رقم الجوال غير صحيح' 
      });
    }

    // Check if user exists
    const existingUser = await User.findByPhone(phone);
    if (existingUser) {
      return res.status(200).json({
        success: true,
        message: 'مستخدم موجود مسبقاً',
        user: existingUser
      });
    }

    // Create new user
    const user = await User.create(name, phone, email);
    
    res.status(201).json({
      success: true,
      message: 'تم التسجيل بنجاح',
      user
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// جلب مستخدم برقم الجوال
router.get('/phone/:phone', async (req, res) => {
  try {
    const user = await User.findByPhone(req.params.phone);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'المستخدم غير موجود' 
      });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// جلب مستخدم بالـ ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'المستخدم غير موجود' 
      });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;
