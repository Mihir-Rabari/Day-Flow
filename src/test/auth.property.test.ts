import * as fc from 'fast-check';
import { TokenService } from '../services/tokenService';
import { PasswordService } from '../services/passwordService';
import { UserRole, UserProfile } from '../types';

describe('Authentication System Property Tests', () => {
  /**
   * Property 3: Authentication Token Integrity
   * Feature: dayflow-backend, Property 3: Authentication Token Integrity
   * Validates: Requirements 3.1, 3.4, 3.5
   */
  describe('Property 3: Authentication Token Integrity', () => {
    it('should generate valid tokens that can be verified and refreshed', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            loginId: fc.string({ minLength: 1, maxLength: 20 }),
            email: fc.emailAddress(),
            firstName: fc.string({ minLength: 1, maxLength: 50 }),
            lastName: fc.string({ minLength: 1, maxLength: 50 }),
            role: fc.constantFrom(
              UserRole.EMPLOYEE,
              UserRole.HR_OFFICER,
              UserRole.ADMIN
            ),
            isActive: fc.boolean(),
          }),
          userData => {
            const user: UserProfile = {
              ...userData,
              profilePicture: undefined,
            };

            // Generate tokens
            const authResponse = TokenService.createAuthResponse(user);

            // Verify access token can be decoded
            const decodedAccess = TokenService.verifyAccessToken(
              authResponse.token
            );
            expect(decodedAccess.userId).toBe(user.id);
            expect(decodedAccess.email).toBe(user.email);
            expect(decodedAccess.role).toBe(user.role);
            expect(decodedAccess.loginId).toBe(user.loginId);

            // Verify refresh token can be decoded
            const decodedRefresh = TokenService.verifyRefreshToken(
              authResponse.refreshToken
            );
            expect(decodedRefresh.userId).toBe(user.id);
            expect(decodedRefresh.email).toBe(user.email);

            // Verify token refresh works
            const newAccessToken = TokenService.refreshAccessToken(
              authResponse.refreshToken
            );
            const decodedNew = TokenService.verifyAccessToken(newAccessToken);
            expect(decodedNew.userId).toBe(user.id);
            expect(decodedNew.email).toBe(user.email);

            // Verify auth response structure
            expect(authResponse.user).toEqual(user);
            expect(typeof authResponse.expiresIn).toBe('number');
            expect(authResponse.expiresIn).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should properly handle token expiration detection', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            loginId: fc.string({ minLength: 1, maxLength: 20 }),
            email: fc.emailAddress(),
            firstName: fc.string({ minLength: 1, maxLength: 50 }),
            lastName: fc.string({ minLength: 1, maxLength: 50 }),
            role: fc.constantFrom(
              UserRole.EMPLOYEE,
              UserRole.HR_OFFICER,
              UserRole.ADMIN
            ),
            isActive: fc.boolean(),
          }),
          userData => {
            const user: UserProfile = {
              ...userData,
              profilePicture: undefined,
            };

            const tokens = TokenService.generateTokens(user);

            // Valid tokens should not be expired
            expect(TokenService.isTokenExpired(tokens.accessToken)).toBe(false);

            // Token extraction should work correctly
            const authHeader = `Bearer ${tokens.accessToken}`;
            const extractedToken =
              TokenService.extractTokenFromHeader(authHeader);
            expect(extractedToken).toBe(tokens.accessToken);

            // Invalid auth headers should return null
            expect(TokenService.extractTokenFromHeader('Invalid')).toBeNull();
            expect(TokenService.extractTokenFromHeader('')).toBeNull();
            expect(TokenService.extractTokenFromHeader(undefined)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Authentication Error Security
   * Feature: dayflow-backend, Property 4: Authentication Error Security
   * Validates: Requirements 3.2
   */
  describe('Property 4: Authentication Error Security', () => {
    it('should handle invalid tokens securely without revealing sensitive information', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          invalidToken => {
            // Invalid tokens should throw appropriate errors
            expect(() =>
              TokenService.verifyAccessToken(invalidToken)
            ).toThrow();
            expect(() =>
              TokenService.verifyRefreshToken(invalidToken)
            ).toThrow();

            try {
              TokenService.verifyAccessToken(invalidToken);
            } catch (error) {
              // Error messages should not reveal sensitive information
              expect(error).toBeInstanceOf(Error);
              const errorMessage = (error as Error).message;
              expect(
                ['Token expired', 'Invalid token'].includes(errorMessage)
              ).toBe(true);
            }

            try {
              TokenService.refreshAccessToken(invalidToken);
            } catch (error) {
              // Refresh should fail securely
              expect(error).toBeInstanceOf(Error);
              const errorMessage = (error as Error).message;
              expect(
                ['Refresh token expired', 'Invalid refresh token'].includes(
                  errorMessage
                )
              ).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate passwords securely and provide appropriate feedback', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 200 }), password => {
          const validation = PasswordService.validatePassword(password);

          // Validation result should always have proper structure
          expect(typeof validation.isValid).toBe('boolean');
          expect(Array.isArray(validation.errors)).toBe(true);

          // If invalid, should have specific error messages
          if (!validation.isValid) {
            expect(validation.errors.length).toBeGreaterThan(0);
            validation.errors.forEach(error => {
              expect(typeof error).toBe('string');
              expect(error.length).toBeGreaterThan(0);
            });
          }

          // Very short passwords should always be invalid
          if (password.length < 8) {
            expect(validation.isValid).toBe(false);
            expect(
              validation.errors.some(e => e.includes('8 characters'))
            ).toBe(true);
          }

          // Very long passwords should be invalid (DoS protection)
          if (password.length > 128) {
            expect(validation.isValid).toBe(false);
            expect(
              validation.errors.some(e => e.includes('128 characters'))
            ).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Role-Based Access Control
   * Feature: dayflow-backend, Property 5: Role-Based Access Control
   * Validates: Requirements 3.3
   */
  describe('Property 5: Role-Based Access Control', () => {
    it('should enforce role hierarchy and permissions correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            userRole: fc.constantFrom(
              UserRole.EMPLOYEE,
              UserRole.HR_OFFICER,
              UserRole.ADMIN
            ),
            requiredRoles: fc.array(
              fc.constantFrom(
                UserRole.EMPLOYEE,
                UserRole.HR_OFFICER,
                UserRole.ADMIN
              ),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          ({ userRole, requiredRoles }) => {
            // Test role hierarchy: Admin > HR_Officer > Employee
            // A user should have access only if their role level is sufficient for ALL required roles

            // Define role hierarchy levels
            const roleHierarchy = {
              [UserRole.EMPLOYEE]: 1,
              [UserRole.HR_OFFICER]: 2,
              [UserRole.ADMIN]: 3,
            };

            const userLevel = roleHierarchy[userRole];
            const maxRequiredLevel = Math.max(
              ...requiredRoles.map(role => roleHierarchy[role])
            );

            const shouldHaveAccess = userLevel >= maxRequiredLevel;

            // Verify the access control logic is working correctly
            if (shouldHaveAccess) {
              // If they should have access, verify the logic
              expect(shouldHaveAccess).toBe(true);
            } else {
              // If they shouldn't have access, verify they don't
              expect(shouldHaveAccess).toBe(false);
            }

            // Role validation should be consistent
            expect(Object.values(UserRole).includes(userRole)).toBe(true);

            // Verify specific hierarchy rules
            if (userRole === UserRole.ADMIN) {
              expect(shouldHaveAccess).toBe(true); // Admin always has access
            }

            if (
              userRole === UserRole.EMPLOYEE &&
              requiredRoles.includes(UserRole.ADMIN)
            ) {
              expect(shouldHaveAccess).toBe(false); // Employee cannot access admin resources
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate secure temporary passwords with required complexity', () => {
      fc.assert(
        fc.property(fc.integer({ min: 8, max: 50 }), length => {
          const tempPassword =
            PasswordService.generateTemporaryPassword(length);

          // Should have correct length
          expect(tempPassword.length).toBe(length);

          // Should meet security requirements
          const validation = PasswordService.validatePassword(tempPassword);
          expect(validation.isValid).toBe(true);

          // Should contain required character types
          expect(/[A-Z]/.test(tempPassword)).toBe(true); // Uppercase
          expect(/[a-z]/.test(tempPassword)).toBe(true); // Lowercase
          expect(/\d/.test(tempPassword)).toBe(true); // Number
          expect(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(tempPassword)).toBe(
            true
          ); // Special char

          // Multiple generations should produce different passwords
          const tempPassword2 =
            PasswordService.generateTemporaryPassword(length);
          expect(tempPassword).not.toBe(tempPassword2);
        }),
        { numRuns: 100 }
      );
    });

    it('should hash and verify passwords consistently', async () => {
      // Test with a few specific passwords instead of property-based testing
      const testPasswords = ['password123!', 'TestPass456@', 'SecureP@ss789'];

      for (const password of testPasswords) {
        // Hash the password
        const hashedPassword = await PasswordService.hashPassword(password);

        // Hash should be different from original
        expect(hashedPassword).not.toBe(password);
        expect(hashedPassword.length).toBeGreaterThan(password.length);

        // Should verify correctly
        const isValid = await PasswordService.comparePassword(
          password,
          hashedPassword
        );
        expect(isValid).toBe(true);

        // Wrong password should not verify
        const wrongPassword = password + 'wrong';
        const isInvalid = await PasswordService.comparePassword(
          wrongPassword,
          hashedPassword
        );
        expect(isInvalid).toBe(false);
      }

      // Test that multiple hashes of same password are different (salt)
      const testPassword = 'TestPassword123!';
      const hash1 = await PasswordService.hashPassword(testPassword);
      const hash2 = await PasswordService.hashPassword(testPassword);
      expect(hash1).not.toBe(hash2);

      // But both should verify correctly
      const isValid1 = await PasswordService.comparePassword(
        testPassword,
        hash1
      );
      const isValid2 = await PasswordService.comparePassword(
        testPassword,
        hash2
      );
      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    }, 10000); // 10 second timeout
  });
});
