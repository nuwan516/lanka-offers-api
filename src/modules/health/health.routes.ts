import { Router } from 'express';
import { HealthController } from './health.controller';

const router = Router();
const controller = new HealthController();

router.get('/health', (req, res, next) => {
  controller.getHealth(req, res).catch(next);
});

export const healthRoutes = router;
