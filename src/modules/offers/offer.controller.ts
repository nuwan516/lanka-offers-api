import { Request, Response } from 'express';
import { OfferService } from './offer.service';

export class OfferController {
  constructor(private service: OfferService = new OfferService()) {}

  public async getOffers(req: Request, res: Response): Promise<void> {
    const { bank, category, search, merchant, locationScope, limit, offset } = req.query;

    const result = await this.service.getPublishedOffers({
      bank: typeof bank === 'string' ? bank : undefined,
      category: typeof category === 'string' ? category : undefined,
      search: typeof search === 'string' ? search : undefined,
      merchant: typeof merchant === 'string' ? merchant : undefined,
      locationScope: typeof locationScope === 'string' ? locationScope : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(result);
  }

  public async getOfferById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const offer = await this.service.getPublishedOfferById(id);
    res.json(offer);
  }
}
