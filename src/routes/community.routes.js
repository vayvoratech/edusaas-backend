const express = require("express");
const router = express.Router();

const repo = require("../data");
const { authRequired, } = require("../middleware/auth");

//Create Post 
router.post("/posts", authRequired, async(req, res, next) => { 
    try{
        const {
            title,
            content,
            post_type,
            visibility,
            media_url =  null,
            metadata = null,
        } = req.body

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
    }catch(err){
        console.log(err);
        
        next(err)
    }
})

//Community Feed
router.get("/feed", authRequired, async(req, res, next) => {
    try{
        return res.json(
            await repo.communityPosts.getFeed()
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


