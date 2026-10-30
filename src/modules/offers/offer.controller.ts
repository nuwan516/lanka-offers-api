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

    // Caching policy: immediate withdrawal freshness (no-store).
    // Edge specification: public, max-age=30, s-maxage=60, stale-while-revalidate=30
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  }

  public async getNearbyOffers(req: Request, res: Response): Promise<void> {
    const { lat, lng, radius, bank, category, search, includeNationwide, limit, offset } = req.query;

    const latNum = typeof lat === 'string' ? parseFloat(lat) : NaN;
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : NaN;
    const radiusNum = typeof radius === 'string' ? parseFloat(radius) : undefined;
    const inclNationwide = includeNationwide === 'true' || includeNationwide === '1';

    const result = await this.service.getNearbyOffers({
      lat: latNum,
      lng: lngNum,
      radius: radiusNum,
      bank: typeof bank === 'string' ? bank : undefined,
      category: typeof category === 'string' ? category : undefined,
      search: typeof search === 'string' ? search : undefined,
      includeNationwide: inclNationwide,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  }

  public async getOfferById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const offer = await this.service.getPublishedOfferById(id);
    // Edge specification: public, max-age=15, s-maxage=30, stale-while-revalidate=15
    res.setHeader('Cache-Control', 'no-store');
    res.json(offer);
  }
}
