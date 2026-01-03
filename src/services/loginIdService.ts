import { prisma } from '../database/client';
import { logger } from '../utils/logger';

export class LoginIdService {
  /**
   * Generates a unique Login ID in format: OI[FirstName][LastName][Year][SerialNumber]
   * @param firstName - Employee's first name
   * @param lastName - Employee's last name
   * @param joiningYear - Year of joining (4 digits)
   * @returns Promise<string> - Generated unique Login ID
   */
  static async generateLoginId(
    firstName: string,
    lastName: string,
    joiningYear: number
  ): Promise<string> {
    try {
      // Validate inputs
      this.validateInputs(firstName, lastName, joiningYear);

      // Create name code from first 2 characters of first and last name
      const nameCode = this.createNameCode(firstName, lastName);

      // Get the next serial number for the year
      const serialNumber = await this.getNextSerialNumber(joiningYear);

      // Construct the Login ID
      const loginId = `OI${nameCode}${joiningYear}${serialNumber}`;

      logger.info('Generated Login ID', {
        loginId,
        firstName,
        lastName,
        joiningYear,
        serialNumber,
      });

      return loginId;
    } catch (error) {
      logger.error('Error generating Login ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        firstName,
        lastName,
        joiningYear,
      });
      throw error;
    }
  }

  /**
   * Validates the input parameters for Login ID generation
   */
  private static validateInputs(
    firstName: string,
    lastName: string,
    joiningYear: number
  ): void {
    if (!firstName || firstName.trim().length === 0) {
      throw new Error('First name is required and cannot be empty');
    }

    if (!lastName || lastName.trim().length === 0) {
      throw new Error('Last name is required and cannot be empty');
    }

    if (
      !joiningYear ||
      joiningYear < 1900 ||
      joiningYear > new Date().getFullYear() + 10
    ) {
      throw new Error(
        'Invalid joining year. Must be between 1900 and 10 years from now'
      );
    }

    // Check for minimum length to extract 2 characters
    if (firstName.trim().length < 1) {
      throw new Error('First name must have at least 1 character');
    }

    if (lastName.trim().length < 1) {
      throw new Error('Last name must have at least 1 character');
    }
  }

  /**
   * Creates the name code part of Login ID from first and last names
   * Made public for testing
   */
  public static createNameCode(firstName: string, lastName: string): string {
    // Clean and normalize names - remove spaces and special characters
    const cleanFirstName = firstName
      .trim()
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase();
    const cleanLastName = lastName
      .trim()
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase();

    // Take first 2 characters from each name, pad with 'X' if needed
    const firstPart = (cleanFirstName + 'XX').substring(0, 2);
    const lastPart = (cleanLastName + 'XX').substring(0, 2);

    return firstPart + lastPart;
  }

  /**
   * Gets the next available serial number for the given year
   */
  private static async getNextSerialNumber(
    joiningYear: number
  ): Promise<string> {
    try {
      // Find the last employee with a Login ID containing the year
      const yearString = joiningYear.toString();

      // Query for employees with Login IDs containing the year
      // Using raw query for better performance and exact matching
      const lastEmployee = await prisma.employee.findFirst({
        where: {
          loginId: {
            contains: yearString,
          },
        },
        orderBy: {
          loginId: 'desc',
        },
      });

      let nextSerial = 1;

      if (lastEmployee && lastEmployee.loginId.includes(yearString)) {
        // Extract serial number from the last Login ID
        const serialFromId = this.extractSerialNumber(
          lastEmployee.loginId,
          yearString
        );
        if (serialFromId !== null) {
          nextSerial = serialFromId + 1;
        }
      }

      // Format as 4-digit string with leading zeros
      return nextSerial.toString().padStart(4, '0');
    } catch (error) {
      logger.error('Error getting next serial number', {
        error: error instanceof Error ? error.message : 'Unknown error',
        joiningYear,
      });
      throw new Error('Failed to generate serial number');
    }
  }

  /**
   * Extracts the serial number from a Login ID for the given year
   * Made public for testing
   */
  public static extractSerialNumber(
    loginId: string,
    year: string
  ): number | null {
    try {
      // Login ID format: OI[FirstName][LastName][Year][SerialNumber]
      // Find the year in the Login ID and extract the 4-digit serial after it
      const yearIndex = loginId.indexOf(year);
      if (yearIndex === -1) {
        return null;
      }

      // Serial number starts after the year (4 digits) and is 4 digits long
      const serialStart = yearIndex + year.length;
      const serialEnd = serialStart + 4;

      if (serialEnd > loginId.length) {
        return null;
      }

      const serialString = loginId.substring(serialStart, serialEnd);
      const serial = parseInt(serialString, 10);

      // Validate that it's a valid number
      if (isNaN(serial) || serial < 0) {
        return null;
      }

      return serial;
    } catch (error) {
      logger.error('Error extracting serial number', {
        error: error instanceof Error ? error.message : 'Unknown error',
        loginId,
        year,
      });
      return null;
    }
  }

  /**
   * Validates that a Login ID is unique in the database
   */
  static async validateUniqueness(loginId: string): Promise<boolean> {
    try {
      const existingEmployee = await prisma.employee.findUnique({
        where: { loginId },
      });

      return existingEmployee === null;
    } catch (error) {
      logger.error('Error validating Login ID uniqueness', {
        error: error instanceof Error ? error.message : 'Unknown error',
        loginId,
      });
      throw new Error('Failed to validate Login ID uniqueness');
    }
  }

  /**
   * Generates a unique Login ID with retry mechanism for edge cases
   */
  static async generateUniqueLoginId(
    firstName: string,
    lastName: string,
    joiningYear: number,
    maxRetries: number = 10
  ): Promise<string> {
    let attempts = 0;

    while (attempts < maxRetries) {
      const loginId = await this.generateLoginId(
        firstName,
        lastName,
        joiningYear
      );
      const isUnique = await this.validateUniqueness(loginId);

      if (isUnique) {
        return loginId;
      }

      attempts++;
      logger.warn('Login ID collision detected, retrying', {
        loginId,
        attempt: attempts,
        firstName,
        lastName,
        joiningYear,
      });

      // If collision occurs, we need to increment manually
      // This is a rare edge case that might happen with concurrent requests
      if (attempts >= maxRetries) {
        throw new Error(
          `Failed to generate unique Login ID after ${maxRetries} attempts`
        );
      }
    }

    throw new Error('Failed to generate unique Login ID');
  }
}
