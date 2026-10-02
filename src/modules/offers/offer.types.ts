export interface CardEligibilityDto {
  cardTypes: string[];
  networks: string[];
  includedCards: string[];
  excludedCards: string[];
  restrictions: string[];
}

export interface GeoLocationDto {
  name?: string;
  district?: string;
  city?: string;
  address?: string;
  lat?: number;
  lng?: number;
  confidence?: number;
}

export interface PublicOfferSummary {
  id: string;
  unique_id: string;
  bank: string;
  source_url: string | null;
  title: string;
  category: string | null;
  card_type: string | null;
  merchant_name: string | null;
  merchant_location: string | null;
  canonical_merchant: string | null;
  location_scope: string | null;
  discount_percentage: string | null;
  valid_from: string | null;
  valid_to: string | null;
  card_eligibility: CardEligibilityDto | null;
  geo_locations: GeoLocationDto[];
  geo_status: string | null;
  db_status: 'PUBLISHED';
  created_at: string;
  updated_at: string;
}

export interface PublicOfferDetail extends PublicOfferSummary {
  raw_offer?: Record<string, unknown>;
}

export interface OfferListQueryOptions {
  bank?: string;
  category?: string;
  search?: string;
  merchant?: string;
  locationScope?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
