import { OfferRepository } from './offer.repository';
import {
  NearbyOffersQueryOptions,
  OfferListQueryOptions,
  PaginatedResult,
  PublicOfferDetail,
  PublicOfferSummary,
} from './offer.types';
import { AppError } from '../../middleware/error-handler';
import { ERROR_CODES } from '../../config/constants';

export class OfferService {
  constructor(private repository: OfferRepository = new OfferRepository()) {}

  public async getPublishedOffers(options: OfferListQueryOptions): Promise<PaginatedResult<PublicOfferSummary>> {
    return this.repository.findPublishedOffers(options);
  }

  public async getNearbyOffers(options: NearbyOffersQueryOptions): Promise<PaginatedResult<PublicOfferSummary>> {
    if (
      typeof options.lat !== 'number' ||
      isNaN(options.lat) ||
      options.lat < -90 ||
      options.lat > 90 ||
      typeof options.lng !== 'number' ||
      isNaN(options.lng) ||
      options.lng < -180 ||
      options.lng > 180
    ) {
      throw new AppError(
        'Valid lat (-90 to 90) and lng (-180 to 180) coordinates are required',
        400,
        ERROR_CODES.INVALID_QUERY
      );
    }

    return this.repository.findNearbyOffers(options);
  }

  public async getPublishedOfferById(idOrUniqueId: string): Promise<PublicOfferDetail> {
    const trimmed = idOrUniqueId.trim();
    if (!trimmed) {
      throw new AppError('Offer identifier is required', 400, ERROR_CODES.INVALID_QUERY);
    }

    const offer = await this.repository.findPublishedOfferById(trimmed);
    if (!offer) {
      throw new AppError(
        `Offer not found or not published: ${trimmed}`,
        404,
        ERROR_CODES.OFFER_NOT_FOUND
      );
    }

    return offer;
  }
}
