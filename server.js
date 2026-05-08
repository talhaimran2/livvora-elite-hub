import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Agar aapke paas CSS ya images hain to unhe 'public' folder mein daal kar ye line use karein
app.use(express.static('public'));

app.get('/', (req, res) => {
    // Ye aapki index.html file ko browser pe bhejega
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});