import { Request, Response } from 'express';
import { MerchantService } from './merchant.service';
import { OfferService } from '../offers/offer.service';

export class MerchantController {
  constructor(
    private service: MerchantService = new MerchantService(),
    private offerService: OfferService = new OfferService()
  ) {}

  public async getMerchants(_req: Request, res: Response): Promise<void> {
    const merchants = await this.service.getMerchants();
    res.json(merchants);
  }

  public async getMerchantByName(req: Request, res: Response): Promise<void> {
    const { name } = req.params;
    const merchant = await this.service.getMerchantByName(name);
    res.json(merchant);
  }

  public async getMerchantOffers(req: Request, res: Response): Promise<void> {
    const { name } = req.params;
    const { bank, category, limit, offset } = req.query;

    const result = await this.offerService.getPublishedOffers({
      merchant: name,
      bank: typeof bank === 'string' ? bank : undefined,
      category: typeof category === 'string' ? category : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(result);
  }
}

