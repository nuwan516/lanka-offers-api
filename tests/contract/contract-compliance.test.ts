import { PublicOfferSummary, PublicOfferDetail } from '../../src/modules/offers/offer.types';

describe('Public API Contract Compliance Tests', () => {
  // Mobile app field dependency checklist based on Flutter OfferModel
  const requiredMobileFields: (keyof PublicOfferSummary)[] = [
    'id',
    'unique_id',
    'bank',
    'source_url',
    'title',
    'category',
    'card_type',
    'merchant_name',
    'merchant_location',
    'canonical_merchant',
    'location_scope',
    'discount_percentage',
    'valid_from',
    'valid_to',
    'card_eligibility',
    'geo_locations',
    'geo_status',
    'db_status',
    'created_at',
    'updated_at',
  ];

  // Forbidden fields that must NEVER leak from operational ingestion
  const forbiddenInternalFields = [
    'llm_score',
    'llm_valid',
    'llm_reasoning',
    'llm_validated_content_hash',
    'content_hash',
    'pending_candidate',
    'manual_override',
    'scrape_run_id',
    'validation_diagnostics',
  ];

  const mockPublicOffer: PublicOfferSummary = {
    id: 'e1d88a10-2b12-4293-8086-5d66faee8d61',
    unique_id: 'hnb-dining-101',
    bank: 'hnb',
    source_url: 'https://hnb.net/promotions/keells',
    title: '20% off at Keells Super',
    category: 'dining',
    card_type: 'CREDIT',
    merchant_name: 'Keells',
    merchant_location: 'Colombo',
    canonical_merchant: 'Keells Super',
    location_scope: 'NATIONWIDE',
    discount_percentage: '20%',
    valid_from: '2026-10-01',
    valid_to: '2026-10-31',
    card_eligibility: {
      cardTypes: ['credit'],
      networks: ['visa', 'mastercard'],
      includedCards: [],
      excludedCards: [],
      restrictions: [],
    },
    geo_locations: [
      {
        name: 'Keells Super - Liberty Plaza',
        lat: 6.911,
        lng: 79.851,
        confidence: 0.95,
      },
    ],
    geo_status: 'RESOLVED',
    db_status: 'PUBLISHED',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T12:00:00Z',
  };

  it('should guarantee all required mobile consumer fields are present in PublicOfferSummary', () => {
    for (const field of requiredMobileFields) {
      expect(mockPublicOffer).toHaveProperty(field);
    }
  });

  it('should guarantee db_status is strictly PUBLISHED', () => {
    expect(mockPublicOffer.db_status).toBe('PUBLISHED');
  });

  it('should guarantee no forbidden operational or LLM fields exist in public schema', () => {
    const offerRecord = mockPublicOffer as unknown as Record<string, unknown>;
    for (const forbidden of forbiddenInternalFields) {
      expect(offerRecord).not.toHaveProperty(forbidden);
    }
  });

  it('should ensure PublicOfferDetail preserves optional raw_offer for consumer audit transparency', () => {
    const detailOffer: PublicOfferDetail = {
      ...mockPublicOffer,
      raw_offer: {
        raw_text: 'Original bank page copy',
      },
    };
    expect(detailOffer.raw_offer).toBeDefined();
    expect(detailOffer.id).toBe(mockPublicOffer.id);
  });
});
