import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080; // Railway uses process.env.PORT

app.use(cors());

// Configure S3 Client for Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT, 
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
    }
});

app.get('/', (req, res) => {
    res.send('R2 High-Speed Proxy is running.');
});

// The main Proxy Route: Streams file from Cloudflare R2 straight to user
app.get('/:filename', async (req, res) => {
    const { filename } = req.params;

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: filename // e.g., "Beat Saber.apk"
        });

        // Fetch the object stream from R2
        const response = await s3Client.send(command);

        // Forward the correct content headers to the user so it downloads properly
        res.setHeader('Content-Length', response.ContentLength);
        res.setHeader('Content-Type', response.ContentType || 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Proxy the stream directly to the client
        // This hides the actual R2 Bucket URL from the public
        response.Body.pipe(res);

    } catch (err) {
        if (err.name === 'NoSuchKey') {
            return res.status(404).send('File not found in archive.');
        }
        console.error('Proxy Error:', err);
        res.status(500).send('Internal Server Error while proxying file.');
    }
});

// Bind to 0.0.0.0 for Railway compatibility
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Global Proxy Server running on port ${PORT}`);
});