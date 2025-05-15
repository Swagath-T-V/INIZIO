const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: './public/uploads/profile-images/',
    filename: (req, file, cb) => {
        cb(null, `profile-${req.session.user}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only .jpg, .jpeg, and .png images are allowed!'));
        }
    }
}).single('profileImage');

module.exports = upload;