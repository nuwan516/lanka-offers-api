import { Request, Response } from 'express';
import { MerchantService } from './merchant.service';

export class MerchantController {
  constructor(private service: MerchantService = new MerchantService()) {}

  public async getMerchants(_req: Request, res: Response): Promise<void> {
    const merchants = await this.service.getMerchants();
    res.json(merchants);
  }
}
