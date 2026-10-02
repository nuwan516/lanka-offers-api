# Lanka Offers — Public API Reference

The backend provides the following REST endpoints under `/api`.

---

### `GET /api/health`
Returns service and database connectivity status.
```json
{
  "status": "healthy",
  "service": "lanka-offers-backend-api",
  "version": "1.0.0",
  "database": "connected",
  "timestamp": "2026-10-03T02:00:00.000Z",
  "uptimeSeconds": 120
}
```

---

### `GET /api/offers`
Returns paginated list of published, active bank card offers.

**Query Parameters:**
- `bank`: string (e.g. `hnb`, `sampath`, `boc`, `combank`, etc.)
- `category`: string (e.g. `Dining`, `Hotels`, `Supermarket`)
- `search`: string (case-insensitive keyword match across title and merchant)
- `merchant`: string (filter by merchant name or canonical identity)
- `locationScope`: string (`EXPLICIT_BRANCH`, `MULTIPLE_BRANCHES`, `SELECTED_OUTLETS`, `DISTRICT_REGION`, `NATIONWIDE`, `ONLINE`, `UNRESOLVED`)
- `limit`: integer (default `50`, max `500`)
- `offset`: integer (default `0`)

**Response:**
```json
{
  "items": [
    {
      "id": "c1f7a0de-4412-4217-a065-27a96a987d60",
      "unique_id": "hnb-dining-1024",
      "bank": "hnb",
      "source_url": "https://venus.hnb.lk/promotions/...",
      "title": "20% OFF at Waters Edge",
      "category": "Dining",
      "card_type": "Credit Card",
      "merchant_name": "Waters Edge",
      "merchant_location": "Battaramulla",
      "canonical_merchant": "Waters Edge",
      "location_scope": "EXPLICIT_BRANCH",
      "discount_percentage": "20",
      "valid_from": "2026-10-01",
      "valid_to": "2026-10-31",
      "card_eligibility": {
        "cardTypes": ["Credit Card"],
        "networks": ["Visa", "Mastercard"],
        "includedCards": ["Visa Signature", "World Mastercard"],
        "excludedCards": ["Corporate"],
        "restrictions": ["Except Corporate cards"]
      },
      "geo_locations": [
        {
          "name": "Waters Edge Battaramulla",
          "district": "Colombo",
          "city": "Battaramulla",
          "lat": 6.8988,
          "lng": 79.9167,
          "confidence": 0.95
        }
      ],
      "geo_status": "verified",
      "db_status": "PUBLISHED",
      "created_at": "2026-10-01T10:00:00Z",
      "updated_at": "2026-10-02T14:00:00Z"
    }
  ],
  "total": 450,
  "limit": 50,
  "offset": 0
}
```

---

### `GET /api/offers/:id`
Retrieves a single offer by internal UUID or `unique_id`.
Returns 404 if not found or not in `PUBLISHED` status.

---

### `GET /api/merchants`
Returns aggregated directory of canonical merchants with active offer counts.

---

### `GET /api/banks`
Returns supported banks list with active offer counts and card types.
