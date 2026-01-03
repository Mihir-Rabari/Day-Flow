import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || '',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10),
    poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT || '20', 10),
    maxIdleTime: parseInt(process.env.DB_MAX_IDLE_TIME || '300', 10), // 5 minutes
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: {
      email: process.env.FROM_EMAIL || 'noreply@dayflow.com',
      name: process.env.FROM_NAME || 'Dayflow HR System',
    },
  },
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    rateLimitWindowMs: parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || '900000',
      10
    ),
    rateLimitMaxRequests: parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || '100',
      10
    ),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },
  performance: {
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '10', 10),
    queryTimeout: parseInt(process.env.QUERY_TIMEOUT || '30000', 10), // 30 seconds
    enableQueryOptimization: process.env.ENABLE_QUERY_OPTIMIZATION === 'true',
  },
};
