const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

async function run() {
  try {
    await connectDB();
    const user = await User.findOne({ email: 'princegajera0506@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }
    const token = jwt.sign(
      { id: user._id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    console.log('--- JWT TOKEN ---');
    console.log(token);
    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
