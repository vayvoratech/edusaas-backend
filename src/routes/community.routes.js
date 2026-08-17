const express = require("express");
const router = express.Router();

const repo = require("../data");
const { authRequired } = require("../middleware/auth");
const redisClient = require("../services/redisClient");

// Helper to clear community feed cache
const clearCommunityCache = async () => {
  if (!redisClient) return;
  try {
    const keys = await redisClient.keys('community:feed:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error('Redis cache invalidation error:', err);
  }
};

// ─── Create Post ────────────────────────────────────────────────────────────
router.post("/posts", authRequired, async (req, res, next) => {
  try {
    const {
      title,
      content,
      post_type,
      visibility = "Public",
      media_url = null,
      metadata = null,
    } = req.body;

    const post = await repo.communityPosts.create({
      author_id: req.user.sub,
      title,
      content,
      post_type,
      visibility,
      media_url,
      metadata,
    });

    await clearCommunityCache();
    return res.status(201).json(post);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

// ─── Community Feed ──────────────────────────────────────────────────────────
router.get("/feed", authRequired, async (req, res, next) => {
  try {
    const { post_type, page = 1, limit = 20 } = req.query;
    const userRole = req.user.role || 'public';
    const cacheKey = `community:feed:${post_type || 'all'}:${userRole}:${page}:${limit}`;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    const data = await repo.communityPosts.getFeed({
      post_type: post_type || undefined,
      page: Number(page),
      limit: Number(limit),
      userId: req.user.sub,
      userRole: req.user.role,
    });

    if (redisClient) {
      // Cache for 60 seconds
      await redisClient.setex(cacheKey, 60, JSON.stringify(data));
    }

    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── Get Single Post ─────────────────────────────────────────────────────────
router.get("/posts/:id", authRequired, async (req, res, next) => {
  try {
    const post = await repo.communityPosts.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    return res.json(post);
  } catch (err) {
    next(err);
  }
});

// ─── Update Post ─────────────────────────────────────────────────────────────
router.put("/posts/:id", authRequired, async (req, res, next) => {
  try {
    const existing = await repo.communityPosts.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (existing.author_id !== req.user.sub && req.user.role !== "admin") {
      return res.status(403).json({ message: "You cannot edit this post" });
    }
    const post = await repo.communityPosts.update(req.params.id, req.body);
    await clearCommunityCache();
    return res.json(post);
  } catch (err) {
    next(err);
  }
});

// ─── Delete Post ─────────────────────────────────────────────────────────────
router.delete("/posts/:id", authRequired, async (req, res, next) => {
  try {
    const existing = await repo.communityPosts.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (existing.author_id !== req.user.sub && req.user.role !== "admin") {
      return res.status(403).json({ message: "You cannot delete this post" });
    }
    await repo.communityPosts.softDelete(req.params.id);
    await clearCommunityCache();
    return res.json({ success: true, message: "Post deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// ─── Posts by Author ─────────────────────────────────────────────────────────
router.get("/users/:userId/posts", authRequired, async (req, res, next) => {
  try {
    const posts = await repo.communityPosts.findByAuthor(req.params.userId);
    return res.json(posts);
  } catch (err) {
    next(err);
  }
});

// ─── Toggle Like (Reaction) on a Post ────────────────────────────────────────
router.post("/posts/:id/like", authRequired, async (req, res, next) => {
  try {
    const result = await repo.communityPosts.toggleReaction(
      req.user.sub,
      req.params.id
    );
    await clearCommunityCache();
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Get Comments for a Post ─────────────────────────────────────────────────
router.get("/posts/:id/comments", authRequired, async (req, res, next) => {
  try {
    const comments = await repo.communityPosts.getComments(req.params.id);
    return res.json(comments);
  } catch (err) {
    next(err);
  }
});

// ─── Add Comment to a Post ───────────────────────────────────────────────────
router.post("/posts/:id/comments", authRequired, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ message: "Comment content is required" });
    }
    const comment = await repo.communityPosts.addComment(
      req.params.id,
      req.user.sub,
      content.trim()
    );
    await clearCommunityCache();
    return res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
