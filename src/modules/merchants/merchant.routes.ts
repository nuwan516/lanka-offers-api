import { Router } from 'express';
import { MerchantController } from './merchant.controller';

const router = Router();
const controller = new MerchantController();

router.get('/merchants', (req, res, next) => {
  controller.getMerchants(req, res).catch(next);
});

export const merchantRoutes = router;
