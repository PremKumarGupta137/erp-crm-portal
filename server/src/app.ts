import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction } from './env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth.routes';
import challanRoutes from './modules/challans.routes';
import customerRoutes from './modules/customers.routes';
import dashboardRoutes from './modules/dashboard.routes';
import productRoutes from './modules/products.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header = server-to-server / Postman / curl — allow it.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
          return callback(null, true);
        }
        // In development, accept any localhost port. Vite silently moves to
        // 5174+ when 5173 is busy, and a hard-coded allowlist turns that into a
        // confusing "login does nothing" instead of an obvious error.
        // Production still uses the explicit allowlist only.
        if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.get('/health', (_req, res) => {
    res.json({ success: true, status: 'ok', uptime: process.uptime(), env: env.nodeEnv });
  });

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      name: 'Mini ERP + CRM Operations Portal API',
      version: '1.0.0',
      docs: '/api',
    });
  });

  app.get('/api', (_req, res) => {
    res.json({
      success: true,
      endpoints: {
        auth: ['POST /api/auth/login', 'GET /api/auth/me', 'POST /api/auth/register', 'GET /api/auth/users'],
        customers: [
          'GET /api/customers',
          'POST /api/customers',
          'GET /api/customers/:id',
          'PUT /api/customers/:id',
          'POST /api/customers/:id/follow-ups',
        ],
        products: [
          'GET /api/products',
          'POST /api/products',
          'GET /api/products/categories',
          'GET /api/products/:id',
          'PUT /api/products/:id',
          'POST /api/products/:id/stock',
          'GET /api/products/movements/all',
        ],
        challans: [
          'GET /api/challans',
          'POST /api/challans',
          'GET /api/challans/:id',
          'PUT /api/challans/:id',
          'POST /api/challans/:id/confirm',
          'POST /api/challans/:id/cancel',
        ],
        dashboard: ['GET /api/dashboard/summary'],
      },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/challans', challanRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
