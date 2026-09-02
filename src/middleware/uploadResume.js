const path = require("path");
const fs = require("fs");
const multer = require("multer");

const resumeDirectory = path.join(
  __dirname,
  "../../uploads/resumes"
);

fs.mkdirSync(resumeDirectory, {
  recursive: true,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resumeDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const uniqueName =
      `${req.user.sub}-${Date.now()}${extension}`;

    cb(null, uniqueName);
  },
});

const uploadResume = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return cb(
        new Error("Only PDF, DOC, and DOCX files are allowed.")
      );
    }

    cb(null, true);
  },
});

module.exports = uploadResume;