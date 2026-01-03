import { Router } from 'express';
import { SalaryController } from '../controllers/salaryController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Current user salary routes
router.get('/me/structure', SalaryController.getMySalaryStructure);
router.get('/me/components', SalaryController.getMySalaryComponents);
router.get('/me/payslip/:month/:year', SalaryController.getMyPayslip);

// Admin/HR salary management routes
router.get('/structure/:employeeId', SalaryController.getSalaryStructure);
router.put('/structure/:employeeId', SalaryController.updateSalaryStructure);
router.get('/components/:employeeId', SalaryController.getSalaryComponents);
router.get('/payslip/:employeeId/:month/:year', SalaryController.generatePayslip);

export default router;