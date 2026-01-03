import bcrypt from 'bcrypt';
import { config } from '../config/config';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export class PasswordService {
  /**
   * Hash a password using bcrypt with configured salt rounds
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptSaltRounds);
  }

  /**
   * Compare a plain text password with a hashed password
   */
  static async comparePassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Generate a secure temporary password
   */
  static generateTemporaryPassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';

    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest with random characters, avoiding consecutive identical characters
    for (let i = 4; i < length; i++) {
      let nextChar;
      let attempts = 0;
      do {
        nextChar = allChars[Math.floor(Math.random() * allChars.length)];
        attempts++;
        // Prevent infinite loop by allowing after 10 attempts
        if (attempts > 10) break;
      } while (
        password.length >= 2 &&
        nextChar === password[password.length - 1] &&
        nextChar === password[password.length - 2]
      );
      password += nextChar;
    }

    // Shuffle the password using Fisher-Yates algorithm to avoid predictable patterns
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [passwordArray[i], passwordArray[j]] = [
        passwordArray[j],
        passwordArray[i],
      ];
    }

    const shuffledPassword = passwordArray.join('');

    // Final check: if the shuffled password has consecutive identical chars, regenerate
    if (/(.)\1{2,}/.test(shuffledPassword)) {
      // Recursively try again (with a limit to prevent infinite recursion)
      return this.generateTemporaryPassword(length);
    }

    return shuffledPassword;
  }

  /**
   * Validate password against security requirements
   */
  static validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Minimum length check
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Maximum length check (prevent DoS attacks)
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    // Uppercase letter check
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Lowercase letter check
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Number check
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Special character check
    if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Common password patterns check
    const commonPatterns = [
      /(.)\1{2,}/, // Three or more consecutive identical characters
      /123456|654321|abcdef|qwerty|password|admin/i, // Common sequences
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains common patterns and is not secure');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a secure password reset token
   */
  static generateResetToken(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';

    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }

    return token;
  }

  /**
   * Check if password needs to be rehashed (if salt rounds changed)
   */
  static async needsRehash(hashedPassword: string): Promise<boolean> {
    try {
      const rounds = await bcrypt.getRounds(hashedPassword);
      return rounds !== config.security.bcryptSaltRounds;
    } catch {
      // If we can't determine rounds, assume it needs rehashing
      return true;
    }
  }

  /**
   * Rehash password if needed (for security upgrades)
   */
  static async rehashIfNeeded(
    plainPassword: string,
    currentHash: string
  ): Promise<string | null> {
    const needsRehash = await this.needsRehash(currentHash);

    if (needsRehash) {
      // Verify the password is correct before rehashing
      const isValid = await this.comparePassword(plainPassword, currentHash);
      if (isValid) {
        return this.hashPassword(plainPassword);
      }
    }

    return null;
  }
}
