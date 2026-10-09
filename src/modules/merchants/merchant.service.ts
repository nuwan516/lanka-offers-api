import { MerchantRepository, MerchantSummaryDto } from './merchant.repository';
import { AppError } from '../../middleware/error-handler';
import { ERROR_CODES } from '../../config/constants';

export class MerchantService {
  constructor(private repository: MerchantRepository = new MerchantRepository()) {}

  public async getMerchants(): Promise<MerchantSummaryDto[]> {
    return this.repository.getMerchantSummaries();
  }

  public async getMerchantByName(name: string): Promise<MerchantSummaryDto> {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new AppError('Merchant name is required', 400, ERROR_CODES.INVALID_QUERY);
    }
    const merchant = await this.repository.getMerchantByName(trimmed);
    if (!merchant) {
      throw new AppError(`Merchant not found: ${trimmed}`, 404, 'MERCHANT_NOT_FOUND');
    }
    return merchant;
  }
}

