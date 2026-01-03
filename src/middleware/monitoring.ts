import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import os from 'os';

interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  loadAverage: number[];
  freeMemory: number;
  totalMemory: number;
  activeRequests: number;
}

class MonitoringService {
  private activeRequests: number = 0;
  private requestCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private responseTimes: number[] = [];
  private lastCpuUsage: NodeJS.CpuUsage = process.cpuUsage();

  incrementActiveRequests(): void {
    this.activeRequests++;
  }

  decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  recordRequest(method: string, path: string): void {
    const key = `${method} ${path}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
  }

  recordError(statusCode: number): void {
    const key = statusCode.toString();
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  getSystemMetrics(): SystemMetrics {
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: currentCpuUsage,
      loadAverage: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      activeRequests: this.activeRequests,
    };
  }

  getRequestStats() {
    const avgResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;

    const p95ResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.sort((a, b) => a - b)[Math.floor(this.responseTimes.length * 0.95)]
      : 0;

    return {
      totalRequests: Array.from(this.requestCounts.values()).reduce((a, b) => a + b, 0),
      requestsByEndpoint: Object.fromEntries(this.requestCounts),
      errorsByStatusCode: Object.fromEntries(this.errorCounts),
      averageResponseTime: Math.round(avgResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      activeRequests: this.activeRequests,
    };
  }

  logSystemHealth(): void {
    const metrics = this.getSystemMetrics();
    const stats = this.getRequestStats();

    // Check for concerning metrics
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    const freeMemoryPercent = (metrics.freeMemory / metrics.totalMemory) * 100;

    if (memoryUsagePercent > 90) {
      logger.warn('High memory usage detected', {
        memoryUsagePercent: Math.round(memoryUsagePercent),
        heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024),
      });
    }

    if (freeMemoryPercent < 10) {
      logger.warn('Low system memory available', {
        freeMemoryPercent: Math.round(freeMemoryPercent),
        freeMemoryMB: Math.round(metrics.freeMemory / 1024 / 1024),
        totalMemoryMB: Math.round(metrics.totalMemory / 1024 / 1024),
      });
    }

    if (stats.averageResponseTime > 1000) {
      logger.warn('High average response time detected', {
        averageResponseTime: stats.averageResponseTime,
        p95ResponseTime: stats.p95ResponseTime,
        activeRequests: stats.activeRequests,
      });
    }

    if (metrics.activeRequests > 100) {
      logger.warn('High number of active requests', {
        activeRequests: metrics.activeRequests,
        uptime: metrics.uptime,
      });
    }

    // Log periodic health summary
    logger.info('System health check', {
      uptime: Math.round(metrics.uptime),
      memoryUsagePercent: Math.round(memoryUsagePercent),
      freeMemoryPercent: Math.round(freeMemoryPercent),
      averageResponseTime: stats.averageResponseTime,
      totalRequests: stats.totalRequests,
      activeRequests: stats.activeRequests,
    });
  }

  reset(): void {
    this.requestCounts.clear();
    this.errorCounts.clear();
    this.responseTimes = [];
  }
}

export const monitoringService = new MonitoringService();

export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  monitoringService.incrementActiveRequests();
  monitoringService.recordRequest(req.method, req.route?.path || req.path);

  const startTime = Date.now();

  // Override res.end to capture metrics
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - startTime;
    
    monitoringService.decrementActiveRequests();
    monitoringService.recordResponseTime(duration);
    
    if (res.statusCode >= 400) {
      monitoringService.recordError(res.statusCode);
    }

    return originalEnd(chunk, encoding, cb);
  };

  next();
};

// Health check endpoint handler
export const healthCheckHandler = (req: Request, res: Response): void => {
  const metrics = monitoringService.getSystemMetrics();
  const stats = monitoringService.getRequestStats();

  const health = {
    status: 'OK',
    timestamp: metrics.timestamp,
    uptime: metrics.uptime,
    system: {
      memoryUsage: {
        heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(metrics.memoryUsage.external / 1024 / 1024),
      },
      freeMemory: Math.round(metrics.freeMemory / 1024 / 1024),
      totalMemory: Math.round(metrics.totalMemory / 1024 / 1024),
      loadAverage: metrics.loadAverage.map(load => Math.round(load * 100) / 100),
    },
    requests: {
      active: stats.activeRequests,
      total: stats.totalRequests,
      averageResponseTime: stats.averageResponseTime,
      p95ResponseTime: stats.p95ResponseTime,
    },
  };

  res.status(200).json(health);
};

// Start periodic health logging
export const startHealthMonitoring = (intervalMs: number = 60000): NodeJS.Timeout => {
  return setInterval(() => {
    monitoringService.logSystemHealth();
  }, intervalMs);
};