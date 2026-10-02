export interface BankMetadata {
  code: string;
  name: string;
  cardTypesSupported: ('credit' | 'debit')[];
  logoUrl?: string;
}

export const SUPPORTED_BANKS: BankMetadata[] = [
  { code: 'hnb', name: 'Hatton National Bank', cardTypesSupported: ['credit', 'debit'] },
  { code: 'sampath', name: 'Sampath Bank', cardTypesSupported: ['credit', 'debit'] },
  { code: 'boc', name: 'Bank of Ceylon', cardTypesSupported: ['credit', 'debit'] },
  { code: 'peoples', name: "People's Bank", cardTypesSupported: ['credit', 'debit'] },
  { code: 'seylan', name: 'Seylan Bank', cardTypesSupported: ['credit', 'debit'] },
  { code: 'ndb', name: 'NDB Bank', cardTypesSupported: ['credit', 'debit'] },
  { code: 'dfcc', name: 'DFCC Bank', cardTypesSupported: ['credit', 'debit'] },
  { code: 'pabc', name: 'Pan Asia Bank', cardTypesSupported: ['credit', 'debit'] },
  { code: 'nsb', name: 'National Savings Bank', cardTypesSupported: ['credit', 'debit'] },
  { code: 'combank', name: 'Commercial Bank of Ceylon', cardTypesSupported: ['credit', 'debit'] },
];

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 500,
  DEFAULT_OFFSET: 0,
};

export const ERROR_CODES = {
  OFFER_NOT_FOUND: 'OFFER_NOT_FOUND',
  INVALID_QUERY: 'INVALID_QUERY',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
