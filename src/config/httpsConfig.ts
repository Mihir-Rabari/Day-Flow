import fs from 'fs';
import https from 'https';
import crypto from 'crypto';
import { config } from './config';
import { logger } from '../utils/logger';

export interface HTTPSOptions {
  key?: string;
  cert?: string;
  ca?: string;
  passphrase?: string;
}

/**
 * HTTPS configuration for production deployment
 */
export class HTTPSConfig {
  /**
   * Load SSL certificates for HTTPS server
   */
  static loadSSLCertificates(): HTTPSOptions | null {
    if (config.server.nodeEnv !== 'production') {
      logger.info('HTTPS configuration skipped - not in production mode');
      return null;
    }

    const sslConfig: HTTPSOptions = {};

    try {
      // Load SSL certificate files
      const keyPath = process.env.SSL_KEY_PATH;
      const certPath = process.env.SSL_CERT_PATH;
      const caPath = process.env.SSL_CA_PATH;
      const passphrase = process.env.SSL_PASSPHRASE;

      if (!keyPath || !certPath) {
        logger.warn(
          'SSL certificate paths not configured, HTTPS will not be enabled'
        );
        return null;
      }

      // Verify certificate files exist
      if (!fs.existsSync(keyPath)) {
        throw new Error(`SSL key file not found: ${keyPath}`);
      }

      if (!fs.existsSync(certPath)) {
        throw new Error(`SSL certificate file not found: ${certPath}`);
      }

      // Load certificate files
      sslConfig.key = fs.readFileSync(keyPath, 'utf8');
      sslConfig.cert = fs.readFileSync(certPath, 'utf8');

      // Load CA certificate if provided
      if (caPath && fs.existsSync(caPath)) {
        sslConfig.ca = fs.readFileSync(caPath, 'utf8');
      }

      // Set passphrase if provided
      if (passphrase) {
        sslConfig.passphrase = passphrase;
      }

      logger.info('SSL certificates loaded successfully', {
        keyPath: keyPath.replace(/./g, '*'), // Mask the path for security
        certPath: certPath.replace(/./g, '*'),
        hasCA: !!sslConfig.ca,
        hasPassphrase: !!sslConfig.passphrase,
      });

      return sslConfig;
    } catch (error) {
      logger.error('Failed to load SSL certificates', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Create HTTPS server with proper configuration
   */
  static createHTTPSServer(app: any): https.Server | null {
    const sslOptions = this.loadSSLCertificates();

    if (!sslOptions) {
      return null;
    }

    try {
      const httpsServer = https.createServer(sslOptions, app);

      // Configure HTTPS server options
      httpsServer.timeout = 30000; // 30 seconds
      httpsServer.keepAliveTimeout = 5000; // 5 seconds
      httpsServer.headersTimeout = 6000; // 6 seconds

      logger.info('HTTPS server created successfully');
      return httpsServer;
    } catch (error) {
      logger.error('Failed to create HTTPS server', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Validate SSL certificate expiration
   */
  static validateCertificateExpiration(): void {
    const certPath = process.env.SSL_CERT_PATH;

    if (!certPath || !fs.existsSync(certPath)) {
      return;
    }

    try {
      const certContent = fs.readFileSync(certPath, 'utf8');
      const cert = new crypto.X509Certificate(certContent);

      const expirationDate = new Date(cert.validTo);
      const currentDate = new Date();
      const daysUntilExpiration = Math.ceil(
        (expirationDate.getTime() - currentDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiration <= 30) {
        logger.warn('SSL certificate expires soon', {
          expirationDate: expirationDate.toISOString(),
          daysUntilExpiration,
        });
      } else {
        logger.info('SSL certificate validation passed', {
          expirationDate: expirationDate.toISOString(),
          daysUntilExpiration,
        });
      }
    } catch (error) {
      logger.error('Failed to validate SSL certificate expiration', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get recommended security headers for HTTPS
   */
  static getSecurityHeaders(): Record<string, string> {
    return {
      'Strict-Transport-Security':
        'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';",
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }
}
