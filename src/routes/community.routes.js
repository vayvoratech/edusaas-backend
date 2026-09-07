const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

const repo = require("../data");
const { authRequired, } = require("../middleware/auth");
const aimlClient = require("../services/aimlClient");

//Create Post 
router.post(
  "/posts",
  authRequired,
  upload.array('images', 3),
  async (req, res, next) => {
    try {
      const {
        title,
        content,
        post_type,
        media_url = null,
      } = req.body;

      let visibility = req.body.visibility || "Public";
      let metadata = req.body.metadata;

      const VALID_VISIBILITIES = [
        "Public",
        "Students",
        "Educators",
        "Employers",
        "Admins",
      ];

      if (!VALID_VISIBILITIES.includes(visibility)) {
        visibility = "Public";
      }

      if (typeof metadata === 'string' && metadata !== 'null') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          return res.status(400).json({
            error: "Invalid metadata format",
          });
        }
      } else if (metadata === 'null') {
        metadata = null;
      }

      const images = req.files
        ? req.files.map(f => `/uploads/${f.filename}`)
        : [];

      if (images.length > 0) {
        metadata = metadata || {};
        metadata.images = images;
      }

      try {
        const textToAnalyze = `${title} ${content}`.substring(0, 5000); // Max 5000 chars

        const [sentimentResult, toxicityResult] = await Promise.allSettled([
          aimlClient.analyzeSentiment({
            student_id: req.user.sub, // Will be hashed inside aimlClient.js
            course_id: 0,
            discussion_id: 0,
            post_text: textToAnalyze,
          }),
          aimlClient.analyzeToxicity({
            student_id: req.user.sub,
            discussion_id: 0,
            post_text: textToAnalyze,
          })
        ]);
        
        metadata = metadata || {};

        if (sentimentResult.status === 'fulfilled' && sentimentResult.value?.success) {
          metadata.sentiment = sentimentResult.value.data;
        } else if (sentimentResult.status === 'rejected') {
          console.warn("[AIML] Sentiment Analysis skipped:", sentimentResult.reason?.message);
        }

        if (toxicityResult.status === 'fulfilled') {
          metadata.toxicity = toxicityResult.value;
        } else if (toxicityResult.status === 'rejected') {
          console.warn("[AIML] Toxicity Analysis skipped:", toxicityResult.reason?.message);
        }
      } catch (err) {
        console.warn("[AIML] Analysis skipped:", err.message);
      }

      const post = await repo.communityPosts.create({
        author_id: req.user.sub,
        title,
        content,
        post_type,
        visibility,
        media_url,
        metadata,
      });

      // Background task for notifications
      (async () => {
        try {
          const authorName = req.user.name || 'Your connection';
          const authorId = req.user.sub;

          // Check role restrictions from metadata
          const hasRoleRestriction = Array.isArray(metadata?.allowedRoles) && metadata.allowedRoles.length > 0;
          const allowedRoles = hasRoleRestriction 
            ? metadata.allowedRoles.map(r => String(r).toLowerCase())
            : null;

          const isRoleAllowed = (roleName) => {
            if (!roleName) return false;
            const r = roleName.toLowerCase();
            // Admins can always watch any post and receive connection notifications
            if (r === 'admin') return true;
            // If no restriction (Public), all roles are allowed
            if (!allowedRoles) return true;
            return allowedRoles.includes(r);
          };

          const recipientIds = new Set();

          // 1. Get all connections of author (only if their role is allowed or admin)
          const connections = await repo.connections.getConnections(authorId);
          for (const conn of connections) {
            const targetUser = conn.receiverId === authorId ? conn.requester : conn.receiver;
            if (!targetUser || targetUser.id === authorId) continue;

            const targetRole = targetUser.role?.name || (typeof targetUser.role === 'string' ? targetUser.role : null);
            if (isRoleAllowed(targetRole)) {
              recipientIds.add(targetUser.id);
            }
          }

          // 2. For Job and Course: broadcast to students whose domainRole matches notifyDomainRoles
          // CRITICAL: Only broadcast if 'student' role is allowed in visibility!
          if ((post_type === 'Job' || post_type === 'Course') && isRoleAllowed('student')) {
            const notifyRoles = metadata?.notifyDomainRoles || [];
            if (notifyRoles.length > 0) {
              const domainStudents = await repo.prisma.user.findMany({
                where: {
                  role: { name: { equals: 'student', mode: 'insensitive' } },
                  domainRole: {
                    domain_name: { in: notifyRoles }
                  }
                },
                select: { id: true }
              });

              for (const u of domainStudents) {
                if (u.id !== authorId) {
                  recipientIds.add(u.id);
                }
              }
            }
          }

          // 3. Dispatch notifications
          for (const targetUserId of recipientIds) {
            let notifType = 'new_post';
            let notifMessage = `${authorName} created a new post: "${title}"`;

            if (post_type === 'Job') {
              notifType = 'new_job';
              notifMessage = `New Job Opportunity matching your domain: "${title}"`;
            } else if (post_type === 'Course') {
              notifType = 'new_course';
              notifMessage = `New Course recommendation: "${title}"`;
            }

            await repo.notifications.create({
              user_id: targetUserId,
              type: notifType,
              message: notifMessage,
              reference_id: post.id,
            });
          }
        } catch (notifyErr) {
          console.error("Failed to send post notifications", notifyErr);
        }
      })();

      return res.status(201).json(post);

    } catch (err) {
      console.log(err);
      next(err);
    }
  }
);

//Community Feed
router.get("/feed", authRequired, async(req, res, next) => {
    try{
        return res.json(
            await repo.communityPosts.getFeed({ 
                user_role: req.user.role,
                current_user_id: req.user.sub
            })
        );
    } catch(err){
        next(err)
    }
})

//Toggle Bookmark
router.post("/posts/:id/bookmark", authRequired, async (req, res, next) => {
    try {
        const result = await repo.communityPosts.toggleBookmark(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

//Get single post
router.get("/posts/:id", authRequired, async(req, res, next) => {
    try{
        const post = await repo.communityPosts.findById( req.params.id );
        if(!posts){
            return res.status(400).json({
                message: "Posts not found"
            });
        }
        return res.json(post)
    }catch(err){
        next(err)
    }
})

//Update the post
router.put("/post/:id", authRequired, async (req, res, next) => {

    try{
        const existing = await repo.communityPosts.findById(req.params.id);
        if(!existing){
            return res.status(404).json({
                message: "Post not found"
            })
        }

        if(existing.author_id !== req.user.sub && req.user.role !== "admin"){
            return res.status(403).json({
                message: "You cannot edit this post"
            })
        }

        const post = await repo.communityPosts.update(
            req.params.id,
            req.body
        )

        return res.json(post)

    }catch(err){
        next(err)
    }
})

//Delete Post
router.delete("/delete/:id", authRequired, async (req, res, next) => {
    try{
        const existing = await repo.communityPosts.findById(req.params.id);
        if(!existing){
            return res.status(404).json({
                message: "Post not found"
            })
        }

        if(existing.author_id !== req.user.sub && req.user.role !== "admin"){
            return res.status(403).json({
                message: "You cannot delete this post"
            })
        }

        await repo.communityPosts.softDelete(req.params.id);

        return res.json({
            success: true,
            message: "Post deleted successfully"
        })

    }catch(err){
        next(err)
    }
})

//Post by Author
router.get("/users/:userId/posts", authRequired, async (req, res, next) => {
    try{
        const posts = await repo.communityPosts.findByAuthor( req.params.userId)
        return res.json(posts)
    }catch(err){
        next(err)
    }
})

module.exports = router;


