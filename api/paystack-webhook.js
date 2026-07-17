import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const signature = req.headers['x-paystack-signature'];
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (!signature || !paystackSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify signature
    const hash = crypto
      .createHmac('sha512', paystackSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== signature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log(`Webhook: ${event.event}`);

    // Handle events
    if (event.event === 'charge.success') {
      console.log(`✅ Payment successful: ${event.data.reference}`);
      // You can add database update here
    }

    return res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ status: 'error' });
  }
}