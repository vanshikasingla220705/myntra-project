import multer from 'multer'
const upload = multer({ dest: 'uploads/' });

app.post('/uploads', upload.any(), (req, res) => {
  res.send('File uploaded!');
});
