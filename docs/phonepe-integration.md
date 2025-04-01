# PhonePe Payment Gateway Integration

This document outlines how the PhonePe payment gateway is integrated into the application.

## Configuration

The PhonePe configuration is stored in `config/phonepe.config.js`. The configuration includes:

- Client credentials (client ID, client secret, client version)
- Merchant ID
- Environment settings (SANDBOX or PRODUCTION)
- Redirect URLs and callback endpoints

## Integration Flow

### 1. Order Placement

When a user places an order with the payment method "PhonePe", the order is created in the database and the system responds with a `payment_required: true` flag. The frontend should then initiate the payment flow.

### 2. Payment Initiation

After the order is created, the frontend can initiate the payment by calling:

```
POST /app/v1/api/phonepe/initiate
```

with the following payload:

```json
{
  "user_id": "12345",
  "order_id": "67890",
  "amount": 1000.5
}
```

The backend will create a transaction record with "pending" status and return a response with the PhonePe checkout URL:

```json
{
  "error": false,
  "message": "Payment initiated successfully",
  "data": {
    "redirect_url": "https://payment.phonepe.com/checkout/12345...",
    "merchant_order_id": "ORDER_67890_1234567890",
    "phonepe_order_id": "M220FPIWE4PZD_12345",
    "state": "PENDING",
    "expire_at": 1617987654000
  }
}
```

### 3. User Redirection

The frontend should redirect the user to the `redirect_url` provided in the response to complete the payment on PhonePe's checkout page.

### 4. Payment Completion

After the payment is completed (success or failure), PhonePe will:

1. Send a callback to the backend at `/api/payment/phonepe-callback`
2. Redirect the user back to our application at the configured redirect URL

### 5. Payment Verification

The backend can verify the payment status using:

```
POST /app/v1/api/phonepe/status
```

with the following payload:

```json
{
  "merchant_order_id": "ORDER_67890_1234567890"
}
```

The response includes the current payment status and details:

```json
{
  "error": false,
  "message": "Payment status retrieved successfully",
  "data": {
    "merchant_order_id": "ORDER_67890_1234567890",
    "phonepe_order_id": "M220FPIWE4PZD_12345",
    "state": "COMPLETED",
    "amount": 1000.5,
    "payment_details": [
      {
        "transaction_id": "T12345678",
        "payment_mode": "UPI",
        "timestamp": 1617987654000,
        "state": "COMPLETED"
      }
    ]
  }
}
```

## Implementation Files

- `config/phonepe.config.js` - Configuration settings
- `services/phonepe.service.js` - Core PhonePe API integration
- `controllers/payment.controller.js` - API endpoint controllers
- `routes/payment.routes.js` - Route definitions
- `routes/api.routes.js` - Additional API routes integration

## Test Credentials

For testing in sandbox mode, use:

- Client ID: SU2503252031280813644090
- API Key: c8857ce8-6222-4c8b-a9ba-62ee6be6a7ea
- Client Version: 1
- Merchant ID: M220FPIWE4PZD

In the frontend, use PhonePe's sandbox test cards/UPI IDs for testing payments.
