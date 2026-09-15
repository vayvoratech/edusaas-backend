const express = require('express');
const { Webhook } = require('svix');
const repo = require('../data'); // your prismaRepo or data layer

const router = express.Router();

// Webhook endpoint to receive events from Clerk
router.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!CLERK_WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Get headers
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  // If there are no svix headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing Svix headers' });
  }

  // Get body
  const payload = req.body;
  const body = req.body.toString();

  // Create a new Svix instance with your secret
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  let evt;
  try {
    // Verify the payload with the headers
    wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
    evt = JSON.parse(body);
  } catch (err) {
    console.error('Error verifying webhook:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Handle the event
  const { type, data } = evt;
  
  if (type === 'user.deleted') {
    console.log(`[WEBHOOK] Clerk user deleted: ${data.id}`);
    
    // Attempt to delete from postgres database
    try {
      await repo.users.deleteByClerkId(data.id);
      console.log(`[WEBHOOK] Successfully deleted user from Postgres: ${data.id}`);
    } catch (err) {
      console.error("[WEBHOOK] Failed to delete user in Postgres:", err);
    }
  }

  return res.status(200).json({ success: true });
});

module.exports = router;
