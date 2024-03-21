const express = require('express') // for creating the server
const multer = require('multer') // for handling file uploads
const path = require('path') // for file path manipulation
const cors = require('cors') // for enabling Cross-Origin Resource Sharing
const { PDFDocument } = require('pdf-lib'); // for PDF manipulation
const fs = require('fs'); // for file system operations
const dotenv = require('dotenv') // for using .env file

dotenv.config() // loads contents of .env into process.env
// Only required during development, because in production we directly enter the environment variables in VERCEL 


const app = express() // Express application is created

app.use(cors()) // used to allow cross-origin requests
app.use(express.json()); // used to parse incoming JSON payloads

// Static file serving is configured for the folders 'uploads' and 'generated'
// This allows the frontend to access the uploaded and generated files PDF files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/generated', express.static(path.join(__dirname, 'generated')));

//Configure Multer Storage
const storage = multer.diskStorage({ // custom storage engine
  destination: (req, file, cb) => {
    cb(null, 'uploads/') // saves uploaded files to the 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname) // uses the original filename
  }
})

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') { // file filter only accepts PDFs
      cb(null, true)
    } else {
      cb(new Error('Only PDFs are allowed!'), false)
    }
  }
})

// Backend testing route
app.get('/superman', (req, res) => {
  res.json({ msg : 'This test endpoint /superman is workin'})
})

// File Upload route
app.post('/api/upload', upload.single('pdf'), (req, res) => { // accepts a single file upload, with the field name 'pdf'
  const filePath = path.join('uploads', req.file.filename) // saves file to the 'uploads' directory
  res.status(200).json({ message: 'File Uploaded Successfully', filePath })
})

// PDF Download route
app.get('/api/pdf/:filename', (req, res) => { 
  const filePath = path.join('uploads', req.params.filename)
  res.sendFile(filePath) // allows downloading a PDF file from the uploads directory by its filename
})

// Route for generating new pdf from extracted pages
app.post('/api/extract-pages', async (req, res) => {
  try {
    const { originalPdfPath, selectedPages } = req.body;

    // Sort selectedPages in ascending order
    selectedPages.sort((a, b) => a - b);

    const originalPdfBytes = fs.readFileSync(path.join(__dirname, originalPdfPath));
    const originalPdfDoc = await PDFDocument.load(originalPdfBytes);
    const generatedPdfDoc = await PDFDocument.create();

    // Ensure the "generated" folder exists
    const generatedFolderPath = path.join(__dirname, 'generated');
    if (!fs.existsSync(generatedFolderPath)) {
      fs.mkdirSync(generatedFolderPath);
    }

    // Extract the original filename without the path
    const originalFilename = path.basename(originalPdfPath)
    // Remove the extension from the original filename
    const originalName = originalFilename.split('.')[0]
    // Generate a unique name for the new PDF by appending a timestamp
    const generatedPdfName = `${originalName}-${Date.now()}.pdf`;


    // Use Promise.all to wait for all page copying operations to complete
    await Promise.all(selectedPages.map(async (pageNumber) => {
      const [copiedPage] = await generatedPdfDoc.copyPages(originalPdfDoc, [pageNumber - 1]);
      generatedPdfDoc.addPage(copiedPage);
    }));

    const generatedPdfBytes = await generatedPdfDoc.save();

    // const generatedPdfPath = path.join(generatedFolderPath, `new-${Date.now()}.pdf`);
    // fs.writeFileSync(generatedPdfPath, generatedPdfBytes);

    const generatedPdfPath = `generated/${generatedPdfName}`;
    fs.writeFileSync(path.join(__dirname, generatedPdfPath), generatedPdfBytes);

    res.status(200).json({ message: 'New PDF Created Successfully', filePath: generatedPdfPath });
  } catch (error) {
    console.error('Error creating new PDF:', error);
    res.status(500).json({ message: 'Error creating new PDF', error: error.message });
  }
});

app.listen(process.env.port, () => {
  console.log(`Server running at http://localhost:${process.env.port}`)
})