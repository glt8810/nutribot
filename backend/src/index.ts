import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { helmetMiddleware, corsMiddleware, securityHeaders, requestSizeLimit } from './middleware/security';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profiles';
import goalRoutes from './routes/goals';
import planRoutes from './routes/plans';
import { connectRedis } from './lib/redis';
import { ensureKeysExist } from './lib/jwt';

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(securityHeaders);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(requestSizeLimit);

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/profiles', profileRoutes);
app.use('/goals', goalRoutes);
app.use('/plans', planRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
async function start() {
  try {
    // Ensure JWT keys exist
    ensureKeysExist();
    console.log('[JWT] Keys ready');

    // Connect Redis (optional - falls back to in-memory)
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`\n🥗 NutriBot API running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}\n`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
