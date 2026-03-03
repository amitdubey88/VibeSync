const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/vibesync';
  let retries = 5;

  while (retries > 0) {
    try {
      await mongoose.connect(mongoUri);
      console.log('✅ MongoDB connected:', mongoose.connection.host);
      return;
    } catch (err) {
      retries -= 1;
      console.error(`❌ MongoDB connection failed. Retries left: ${retries}`, err.message);
      if (retries === 0) {
        console.warn('⚠️  Running without MongoDB — using in-memory store only');
        return;
      }
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
};

module.exports = connectDB;
