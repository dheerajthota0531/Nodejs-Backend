# PhonePe Integration Troubleshooting Guide

This document provides troubleshooting steps for PhonePe payment gateway integration issues.

## Common Issues

### 1. "UnauthorizedAccess" (HTTP 401) Errors

The most common issue is authentication failures with the PhonePe SDK.

#### Symptoms:

- Orders are created but payments fail
- Logs show "UnauthorizedAccess" or 401 errors
- No payment gateway page is displayed or redirects fail

#### Solutions:

1. **Verify Credentials**

   - Ensure the `clientId`, `clientSecret`, and `merchantId` are correct
   - Double-check for typos or extra spaces
   - Use the test script to verify: `node scripts/test-phonepe-connection.js`

2. **Environment Configuration**

   - Confirm you're using the correct environment (`SANDBOX` or `PRODUCTION`)
   - Sandbox credentials will not work in Production and vice versa
   - If using `SANDBOX`, ensure your account has sandbox access enabled

3. **Domain and Redirect URL Configuration**

   - Ensure your frontend port matches the configuration (e.g., 3001 vs 3000)
   - The PhonePe merchant dashboard must have your domain whitelisted
   - For localhost testing, make sure the port is correct: `http://localhost:3001`
   - Add your full callback URL to PhonePe dashboard: `http://localhost:3001/api/payment/response`
   - Make sure CORS settings in PhonePe dashboard include your domain

4. **Account Activation**

   - Contact PhonePe support to ensure your merchant account is properly activated
   - Verify that API access is enabled for your account
   - Check if your account has any restrictions

5. **SDK Version**

   - Make sure you're using the latest SDK version
   - The package should be installed from the official PhonePe repository:
     ```
     npm i https://phonepe.mycloudrepo.io/public/repositories/phonepe-pg-sdk-node/releases/v2/phonepe-pg-sdk-node.tgz
     ```

6. **Implementation Issues**
   - Ensure you're using the builder pattern correctly for all objects
   - Verify that the `MetaInfo` object is created using the builder
   - Check that all required parameters are provided

## Testing Connection

Run the test script to verify your connection:

```bash
node scripts/test-phonepe-connection.js
```

This script will:

- Show your current configuration
- Test authentication with PhonePe servers
- Provide specific error messages and troubleshooting steps

## Fallback Mechanism

The updated implementation includes a fallback mechanism when PhonePe is unavailable:

1. Before attempting payment, the system checks if PhonePe is available
2. If authentication fails, the system recommends alternative payment methods
3. Orders are properly reverted to 'pending' state if payment initiation fails
4. Detailed error messages help identify the specific cause of failure

## Contact PhonePe Support

If issues persist after following all troubleshooting steps, contact PhonePe support:

1. Provide your merchant ID
2. Share the exact error messages from the logs
3. Include the stack trace and HTTP status codes
4. Mention when the issue started occurring
5. Describe any recent changes to your implementation

## Updating Domain Configuration

When moving from development to production or changing ports:

1. Update the `.env` file with the correct `MERCHANT_DOMAIN`
2. Update the PhonePe merchant dashboard with the new domain
3. Make sure both the callback and redirect URLs are updated
4. Run the test script after making these changes to verify

## Additional Resources

- [PhonePe NodeJs SDK Documentation](https://developer.phonepe.com/docs/pg-sdk/nodejs/)
- [PhonePe Merchant Dashboard](https://dashboard.phonepe.com/)
- [PhonePe Status Page](https://status.phonepe.com/)
