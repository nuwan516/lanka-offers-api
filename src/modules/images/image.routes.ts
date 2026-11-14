import { Router } from 'express';
import { ImageController } from './image.controller';

const router = Router();
const controller = new ImageController();

router.get('/images/:key', (req, res, next) => {
  controller.getImage(req, res).catch(next);
});

export const imageRoutes = router;
