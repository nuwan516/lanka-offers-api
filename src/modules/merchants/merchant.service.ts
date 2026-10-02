import { MerchantRepository, MerchantSummaryDto } from './merchant.repository';

export class MerchantService {
  constructor(private repository: MerchantRepository = new MerchantRepository()) {}

  public async getMerchants(): Promise<MerchantSummaryDto[]> {
    return this.repository.getMerchantSummaries();
  }
}
