const multer = require("multer");

const uploadVideo = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },

  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(
        new Error("Only video files are allowed.")
      );
    }

    cb(null, true);
  },
});

module.exports = uploadVideo;