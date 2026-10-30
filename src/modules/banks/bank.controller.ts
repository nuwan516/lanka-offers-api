import { Request, Response } from 'express';
import { BankService } from './bank.service';

export class BankController {
  constructor(private service: BankService = new BankService()) {}

  public async getBanks(_req: Request, res: Response): Promise<void> {
    const banks = await this.service.getBanks();
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.setHeader('Vary', 'Accept-Encoding, Origin');
    res.json(banks);
  }
}
