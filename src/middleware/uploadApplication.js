
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const resumeDirectory = path.join(
  __dirname,
  "../../uploads/resumes"
);

fs.mkdirSync(resumeDirectory, {
  recursive: true,
});

const storage = {
  _handleFile(req, file, cb) {
    // Resume save to disk
    if (file.fieldname === "resume") {
      const extension = path.extname(file.originalname);

      const uniqueName =
        `${req.user.sub}-${Date.now()}${extension}`;

      const filepath = path.join(
        resumeDirectory,
        uniqueName
      );

      const outStream = fs.createWriteStream(filepath);

      let size = 0;

      file.stream.on("data", (chunk) => {
        size += chunk.length;
      });

      file.stream.on("error", (err) => {
        outStream.destroy();
        cb(err);
      });

      outStream.on("error", (err) => {
        cb(err);
      });

      outStream.on("finish", () => {
        cb(null, {
          destination: resumeDirectory,
          filename: uniqueName,
          path: filepath,
          size,
        });
      });

      file.stream.pipe(outStream);

      return;
    }

    // Video keep in memory for B2 upload
    if (file.fieldname === "video") {
      const chunks = [];
      let size = 0;

      file.stream.on("data", (chunk) => {
        chunks.push(chunk);
        size += chunk.length;
      });

      file.stream.on("error", (err) => {
        cb(err);
      });

      file.stream.on("end", () => {
        cb(null, {
          buffer: Buffer.concat(chunks),
          size,
        });
      });

      return;
    }

    cb(new Error("Unexpected file field."));
  },

  _removeFile(req, file, cb) {
    if (file.path) {
      fs.unlink(file.path, cb);
    } else {
      cb(null);
    }
  },
};

const uploadApplication = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 2,
  },

  fileFilter: (req, file, cb) => {
    if (file.fieldname === "resume") {
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
          new Error(
            "Only PDF, DOC, and DOCX files are allowed."
          )
        );
      }

      return cb(null, true);
    }

    if (file.fieldname === "video") {
      if (!file.mimetype.startsWith("video/")) {
        return cb(
          new Error("Only video files are allowed.")
        );
      }

      return cb(null, true);
    }

    cb(new Error("Unexpected file field."));
  },
});

module.exports = uploadApplication;