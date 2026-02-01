const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');

console.log('上传目录:', uploadDir);

if (!fs.existsSync(uploadDir)) {
  console.log('创建上传目录:', uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
} else {
  console.log('上传目录已存在:', uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('保存文件到:', uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'book-' + uniqueSuffix + path.extname(file.originalname);
    console.log('保存文件为:', filename);
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: fileFilter
});

module.exports = upload;
