import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { config } from './config/config';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import employeeRoutes from './routes/employeeRoutes';
import authRoutes from './routes/authRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import leaveRoutes from './routes/leaveRoutes';

// Load environment variables
dotenv.config();

const app = express();

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

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);

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
  console.log(`🚀 Dayflow Backend server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔧 Environment: ${config.server.nodeEnv}`);
});

export default app;
