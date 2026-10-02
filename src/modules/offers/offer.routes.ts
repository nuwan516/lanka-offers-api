import { Router } from 'express';
import { OfferController } from './offer.controller';

const router = Router();
const controller = new OfferController();

router.get('/offers', (req, res, next) => {
  controller.getOffers(req, res).catch(next);
});

router.get('/offers/:id', (req, res, next) => {
  controller.getOfferById(req, res).catch(next);
});

export const offerRoutes = router;
