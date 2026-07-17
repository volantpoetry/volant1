export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { reference, amount, email, bookId } = req.body;

    // Validate required fields
    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Transaction reference is required'
      });
    }

    if (!amount && amount !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // ===== GET SECRET KEY FROM ENVIRONMENT =====
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    
    if (!PAYSTACK_SECRET_KEY) {
      console.error('❌ PAYSTACK_SECRET_KEY not found in environment');
      return res.status(500).json({
        success: false,
        message: 'Payment service not configured - missing secret key'
      });
    }
    
    console.log('=== PAYMENT VERIFICATION ===');
    console.log('Reference:', reference);
    console.log('Amount:', amount);
    console.log('Email:', email);
    console.log('Environment:', process.env.VERCEL_ENV || 'development');
    console.log('============================');

    // Verify with Paystack
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Paystack response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Paystack error:', errorText);
      return res.status(400).json({
        success: false,
        message: 'Transaction verification failed',
        details: errorText
      });
    }

    const data = await response.json();
    const transaction = data.data;

    console.log('Transaction status:', transaction.status);

    // Strict checks
    if (transaction.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: `Transaction not successful. Status: ${transaction.status}`
      });
    }

    // Verify amount (Paystack returns in kobo)
    const expectedAmount = Math.round(amount * 100);
    if (transaction.amount !== expectedAmount) {
      console.log('Amount mismatch:', transaction.amount, 'vs', expectedAmount);
      return res.status(400).json({
        success: false,
        message: 'Amount mismatch',
        details: {
          expected: amount,
          actual: transaction.amount / 100
        }
      });
    }

    // Verify email
    if (transaction.customer?.email && 
        transaction.customer.email.toLowerCase() !== email.toLowerCase()) {
      console.log('Email mismatch:', transaction.customer.email, 'vs', email);
      return res.status(400).json({
        success: false,
        message: 'Email mismatch'
      });
    }

    // Success
    console.log('✅ Payment verified successfully!');
    return res.status(200).json({
      success: true,
      message: 'Transaction verified successfully',
      data: {
        reference: transaction.reference,
        amount: transaction.amount / 100,
        currency: transaction.currency,
        customer: transaction.customer,
        paidAt: transaction.paidAt
      }
    });

  } catch (error) {
    console.error('❌ Verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}