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
        return res.status(400).json({
          error: "Invalid visibility value",
        });
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

      const post = await repo.communityPosts.create({
        author_id: req.user.sub,
        title,
        content,
        post_type,
        visibility,
        media_url,
        metadata,
      });

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


