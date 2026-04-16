const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDatabase } = require('./config/database');
const { fetchJwtPublicKey } = require('./middleware/auth');
const objectRoutes = require('./routes/objects');
const adminRoutes = require('./routes/admin');
const { setupGraphQL } = require('./graphql');
const errorHandler = require('./middleware/errorHandler');

async function startApp() {
  const app = express();
  const httpServer = http.createServer(app);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    credentials: true,
  }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));

  await connectDatabase();
  await fetchJwtPublicKey();

  app.get('/', (req, res) => {
    res.json({ message: "Hello World! I'm the ObjectService." });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ObjectService', timestamp: new Date().toISOString() });
  });

  app.use('/objects', objectRoutes);
  app.use('/admin', adminRoutes);

  await setupGraphQL(app, httpServer);

  app.use(errorHandler);

  const PORT = process.env.PORT || 3000;
  await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));
  console.log(`ObjectService running on port ${PORT}`);
  console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);

  return { app, httpServer };
}

module.exports = { startApp };
