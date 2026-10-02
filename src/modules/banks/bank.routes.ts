import { Router } from 'express';
import { BankController } from './bank.controller';

const router = Router();
const controller = new BankController();

router.get('/banks', (req, res, next) => {
  controller.getBanks(req, res).catch(next);
});

export const bankRoutes = router;
