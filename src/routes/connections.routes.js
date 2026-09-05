const express = require('express');
const repo = require('../data');
const { authRequired } = require('../middleware/auth'); // Uses your legacy or custom auth check

const router = express.Router();

/**
 * @swagger
 * /api/connections/request/{receiverId}:
 *   post:
 *     summary: Send a connection request to a user
 *     security: [{ bearerAuth: [] }]
 */
router.post('/request/:receiverId', authRequired, async (req, res, next) => {
  try {
    const requesterId = req.user.sub;
    const { receiverId } = req.params;

    if (requesterId === receiverId) {
      return res.status(400).json({ error: "You cannot connect with yourself." });
    }

    const connection = await repo.connections.sendRequest(requesterId, receiverId);
    
    // Trigger a notification for the receiver
    await repo.notifications.create({
      user_id: receiverId,
      type: "connection_request",
      message: `${req.user.name || 'Someone'} sent you a connection request.`,
    });
    
    return res.status(201).json({ success: true, connection });
  } catch (err) {
    console.error("[CONNECTIONS ROUTE ERROR]:", err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: "Connection request already exists." });
    }
    next(err);
  }
});

/**
 * @swagger
 * /api/connections/accept/{connectionId}:
 *   post:
 *     summary: Accept a pending connection request
 *     security: [{ bearerAuth: [] }]
 */
router.post('/accept/:connectionId', authRequired, async (req, res, next) => {
  try {
    const receiverId = req.user.sub;
    const { connectionId } = req.params;

    const result = await repo.connections.acceptRequest(connectionId, receiverId);
    
    if (result.count === 0) {
      return res.status(404).json({ error: "Pending connection request not found." });
    }
    
    return res.json({ success: true, message: "Connection accepted." });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/connections/reject/{connectionId}:
 *   post:
 *     summary: Reject a pending connection request
 *     security: [{ bearerAuth: [] }]
 */
router.post('/reject/:connectionId', authRequired, async (req, res, next) => {
  try {
    const receiverId = req.user.sub;
    const { connectionId } = req.params;

    const result = await repo.connections.rejectRequest(connectionId, receiverId);
    
    if (result.count === 0) {
      return res.status(404).json({ error: "Pending connection request not found." });
    }
    
    return res.json({ success: true, message: "Connection rejected." });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/connections:
 *   get:
 *     summary: Get all accepted connections for the current user
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const connections = await repo.connections.getConnections(userId);
    
    // Format the response so the frontend gets a clean array of "friends"
    const network = connections.map(conn => {
      const friend = conn.requesterId === userId ? conn.receiver : conn.requester;
      return {
        connectionId: conn.id,
        connectedAt: conn.updatedAt,
        user: friend
      };
    });
    
    return res.json({ success: true, network });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/connections/pending:
 *   get:
 *     summary: Get all pending incoming connection requests
 *     security: [{ bearerAuth: [] }]
 */
router.get('/pending', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const pendingRequests = await repo.connections.getPendingRequests(userId);
    return res.json({ success: true, requests: pendingRequests });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/connections/{connectionId}:
 *   delete:
 *     summary: Remove an existing connection or pending request
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:connectionId', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { connectionId } = req.params;

    const result = await repo.connections.removeConnection(connectionId, userId);
    
    if (result.count === 0) {
      return res.status(404).json({ error: "Connection not found or you don't have permission to remove it." });
    }
    
    return res.json({ success: true, message: "Connection removed." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
