import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { config } from './config/config';
import {
  errorHandler,
  handleUnhandledRejection,
  handleUncaughtException,
} from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestLogger } from './middleware/requestLogger';
import {
  monitoringMiddleware,
  healthCheckHandler,
  startHealthMonitoring,
} from './middleware/monitoring';
import { logger } from './utils/logger';
import employeeRoutes from './routes/employeeRoutes';
import authRoutes from './routes/authRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import leaveRoutes from './routes/leaveRoutes';
import salaryRoutes from './routes/salaryRoutes';
import backupRoutes from './routes/backupRoutes';

// Load environment variables
dotenv.config();

// Set up global error handlers
process.on('unhandledRejection', handleUnhandledRejection);
process.on('uncaughtException', handleUncaughtException);

const app = express();

// Start health monitoring
const healthMonitoringInterval = startHealthMonitoring(60000); // Log every minute

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  clearInterval(healthMonitoringInterval);
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  clearInterval(healthMonitoringInterval);
  process.exit(0);
});

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Request logging and monitoring
app.use(requestLogger);
app.use(monitoringMiddleware);

// HTTP request logging (Morgan)
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enhanced health check endpoint
app.get('/health', healthCheckHandler);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/backup', backupRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'Dayflow Backend API',
    version: '1.0.0',
    status: 'running',
  });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.server.port || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 Dayflow Backend server running on port ${PORT}`);
  logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
  logger.info(`🔧 Environment: ${config.server.nodeEnv}`);
});

export default app;
