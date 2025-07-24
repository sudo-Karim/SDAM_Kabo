const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

const db = new sqlite3.Database('./genome_crispr.db');
const PAGE_SIZE = 10;

// Import searchArg and model files
const searchArg = require('./searchArg.js');
const Screen = require('./models/Screen'); 
const Gene = require('./models/Gene');
const Phen = require('./models/Phen');

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/table', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * PAGE_SIZE;

    db.all('SELECT COUNT(*) as count FROM genome_crispr', [], (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });
        const totalRows = countResult[0].count;
        db.all(
            `SELECT * FROM genome_crispr LIMIT ? OFFSET ?`,
            [PAGE_SIZE, offset],
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({
                    data: rows,
                    totalRows,
                    page,
                    pageSize: PAGE_SIZE,
                    totalPages: Math.ceil(totalRows / PAGE_SIZE)
                });
            }
        );
    });
});

// Serving the index.html file at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});