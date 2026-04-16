require('dotenv').config();
const { startApp } = require('./src/app');

startApp().catch((error) => {
  console.error('Failed to start ObjectService:', error);
  process.exit(1);
});
