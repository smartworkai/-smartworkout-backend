// ============================================================
// SMARTWORKOUT AI — Stripe Controller
// ============================================================
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query } = require('../utils/db');

// ─────────────────────────────────────────────
// CREATE CHECKOUT SESSION
// ─────────────────────────────────────────────
exports.createCheckout = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { priceId = process.env.STRIPE_PRO_PRICE_ID } = req.body;

    // Get or create Stripe customer
    let subResult = await query('SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1', [userId]);
    let customerId = subResult.rows[0]?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name:  req.user.name,
        metadata: { userId },
      });
      customerId = customer.id;
      await query('UPDATE subscriptions SET stripe_customer_id = $1 WHERE user_id = $2', [customerId, userId]);
    }

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata:    { userId },
      subscription_data: {
        trial_period_days: 7,   // 7-day free trial
        metadata: { userId },
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// CREATE CUSTOMER PORTAL SESSION
// ─────────────────────────────────────────────
exports.createPortal = async (req, res, next) => {
  try {
    const result = await query('SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1', [req.user.id]);
    const customerId = result.rows[0]?.stripe_customer_id;

    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${process.env.FRONTEND_URL}/profile`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET SUBSCRIPTION STATUS
// ─────────────────────────────────────────────
exports.getSubscription = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT plan, status, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end
       FROM subscriptions WHERE user_id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.json({ plan: 'free', status: 'active' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// CANCEL SUBSCRIPTION
// ─────────────────────────────────────────────
exports.cancelSubscription = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1',
      [req.user.id]
    );

    const subId = result.rows[0]?.stripe_subscription_id;
    if (!subId) return res.status(400).json({ error: 'No active subscription' });

    // Cancel at end of billing period
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    await query(
      'UPDATE subscriptions SET cancel_at_period_end = TRUE WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ message: 'Subscription will cancel at end of billing period.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// STRIPE WEBHOOK HANDLER
// ─────────────────────────────────────────────
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const data = event.data.object;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = data.metadata?.userId;
        if (!userId) break;

        await query(
          `UPDATE subscriptions SET
             plan = 'pro',
             status = 'active',
             stripe_subscription_id = $1,
             stripe_customer_id = $2,
             cancel_at_period_end = FALSE
           WHERE user_id = $3`,
          [data.subscription, data.customer, userId]
        );
        console.log(`✅ Pro activated for user ${userId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = data;
        await query(
          `UPDATE subscriptions SET
             status = $1,
             current_period_start = to_timestamp($2),
             current_period_end = to_timestamp($3),
             cancel_at_period_end = $4
           WHERE stripe_subscription_id = $5`,
          [sub.status, sub.current_period_start, sub.current_period_end, sub.cancel_at_period_end, sub.id]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        await query(
          `UPDATE subscriptions SET plan = 'free', status = 'canceled'
           WHERE stripe_subscription_id = $1`,
          [data.id]
        );
        console.log(`⚠️ Subscription canceled: ${data.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        await query(
          `UPDATE subscriptions SET status = 'past_due'
           WHERE stripe_subscription_id = $1`,
          [data.subscription]
        );
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
