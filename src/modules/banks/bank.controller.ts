import { Request, Response } from 'express';
import { BankService } from './bank.service';

export class BankController {
  constructor(private service: BankService = new BankService()) {}

  public async getBanks(_req: Request, res: Response): Promise<void> {
    const banks = await this.service.getBanks();
    res.json(banks);
  }
}
