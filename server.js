const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { buildSearchQuery } = require('./searchArg');

// Import models
const Gene = require('./model/Gene');
const Phen = require('./model/Phen');
const Screen = require('./model/Screen');
const { GeneView, CellLineView, SgRNAView } = require('./model/GeneView');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure EJS to work with .html files
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'frontend'));

// Serve static assets
app.use('/css', express.static(path.join(__dirname, 'frontend/css')));
app.use('/js', express.static(path.join(__dirname, 'frontend/js')));

// Database connection
const db = new sqlite3.Database('./genome_crispr.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Helper function to determine if search should use gene view
function shouldUseGeneView(searchQuery) {
    // Use gene view if searching for a specific gene symbol
    return searchQuery && 
           searchQuery.length >= 2 && 
           /^[A-Z][A-Z0-9_-]*$/i.test(searchQuery.trim());
}

// Helper function to get gene-based results
function getGeneViewResults(searchQuery, unused1, unused2, page, limit, sortBy, sortOrder, callback) {
    // First, get all records for genes matching the search
    const geneSearchQuery = `
        SELECT rowid, * FROM genome_crispr 
        WHERE symbol LIKE ? OR ensg LIKE ?
        ORDER BY symbol, cellline, ${sortBy} ${sortOrder}
    `;
    
    const searchPattern = `%${searchQuery}%`;
    let params = [searchPattern, searchPattern];
    
    db.all(geneSearchQuery, params, (err, allRows) => {
        if (err) return callback(err, null);
        
        // Group rows by gene symbol
        const geneGroups = new Map();
        allRows.forEach(row => {
            const symbol = row.symbol;
            if (!geneGroups.has(symbol)) {
                geneGroups.set(symbol, []);
            }
            geneGroups.get(symbol).push(row);
        });
        
        // Convert to GeneView objects
        const geneViews = Array.from(geneGroups.values()).map(rows => 
            GeneView.fromDbRows(rows)
        );
        
        // Apply pagination to gene views
        const totalGenes = geneViews.length;
        const totalPages = Math.ceil(totalGenes / limit);
        const offset = (page - 1) * limit;
        const paginatedGenes = geneViews.slice(offset, offset + limit);
        
        callback(null, {
            results: paginatedGenes.map(gv => gv.toJSON()),
            totalRows: totalGenes,
            totalPages: totalPages,
            isGeneView: true
        });
    });
}

// Main route - handles both search and initial page load
app.get('/', (req, res) => {
    const searchQuery = req.query.query || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'rowid';
    const sortOrder = req.query.sortOrder || 'ASC';

    // If there are search parameters, perform search
    if (searchQuery) {
        // Check if we should use gene view
        if (shouldUseGeneView(searchQuery)) {
            getGeneViewResults(searchQuery, null, null, page, limit, sortBy, sortOrder, (err, result) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.render('index', { 
                        error: 'Database error occurred',
                        results: [],
                        totalRows: 0,
                        currentPage: 1,
                        totalPages: 0,
                        searchQuery,
                        itemsPerPage: limit,
                        sortBy,
                        sortOrder,
                        hasSearch: true,
                        isGeneView: false
                    });
                }
                
                res.render('index', {
                    results: result.results,
                    totalRows: result.totalRows,
                    currentPage: page,
                    totalPages: result.totalPages,
                    searchQuery,
                    itemsPerPage: limit,
                    sortBy,
                    sortOrder,
                    hasSearch: true,
                    isGeneView: true,
                    error: null
                });
            });
        } else {
            // Use regular view for non-gene searches
            const { query, countQuery, params } = buildSearchQuery(req.query, {
                page, limit, sortBy, sortOrder
            });

            // First get the count
            db.get(countQuery, params, (err, countResult) => {
                if (err) {
                    console.error('Database count error:', err);
                    return res.render('index', { 
                        error: 'Database error occurred',
                        results: [],
                        totalRows: 0,
                        currentPage: 1,
                        totalPages: 0,
                        searchQuery,
                        itemsPerPage: limit,
                        sortBy,
                        sortOrder,
                        hasSearch: false,
                        isGeneView: false
                    });
                }

                const totalRows = countResult.total || countResult.count;
                const totalPages = Math.ceil(totalRows / limit);

                // Then get the data
                db.all(query, params, (err, rows) => {
                    if (err) {
                        console.error('Database query error:', err);
                        return res.render('index', { 
                            error: 'Database error occurred',
                            results: [],
                            totalRows: 0,
                            currentPage: 1,
                            totalPages: 0,
                            searchQuery,
                            itemsPerPage: limit,
                            sortBy,
                            sortOrder,
                            hasSearch: true,
                            isGeneView: false
                        });
                    }

                    // Format results using Gene model
                    const formattedRows = rows.map(row => {
                        const gene = Gene.fromDbRow({
                            ...row,
                            id: row.rowid // Map rowid to id for the model
                        });
                        return gene.toJSON();
                    });

                    res.render('index', {
                        results: formattedRows,
                        totalRows,
                        currentPage: page,
                        totalPages,
                        searchQuery,
                        itemsPerPage: limit,
                        sortBy,
                        sortOrder,
                        hasSearch: true,
                        isGeneView: false,
                        error: null
                    });
                });
            });
        }
    } else {
        // Render empty search page
        res.render('index', {
            results: [],
            totalRows: 0,
            currentPage: 1,
            totalPages: 0,
            searchQuery: '',
            itemsPerPage: 10,
            sortBy: 'rowid',
            sortOrder: 'ASC',
            hasSearch: false,
            isGeneView: false,
            error: null
        });
    }
});

// Details page route
app.get('/details/:id', (req, res) => {
    const id = req.params.id;
    
    db.get('SELECT rowid, * FROM genome_crispr WHERE rowid = ?', [id], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.render('details', { 
                error: 'Database error occurred', 
                data: null,
                backUrl: req.get('Referer') || '/'
            });
        }
        
        if (!row) {
            return res.render('details', { 
                error: 'Record not found', 
                data: null,
                backUrl: req.get('Referer') || '/'
            });
        }

        // Format data using Gene model
        const gene = Gene.fromDbRow({
            ...row,
            id: row.rowid // Map rowid to id for the model
        });
        const data = gene.toJSON();

        res.render('details', { 
            data, 
            error: null,
            backUrl: req.get('Referer') || '/'
        });
    });
});

// Gene overview route - shows all sgRNAs for a specific gene
app.get('/gene/:symbol', (req, res) => {
    const symbol = req.params.symbol;
    const referer = req.get('Referer');
    
    // Determine appropriate back URL
    let backUrl = '/';
    if (referer) {
        const refererUrl = new URL(referer);
        // If coming from a search results page, go back there
        if (refererUrl.pathname === '/' && refererUrl.search) {
            backUrl = referer;
        } else if (refererUrl.pathname === '/') {
            // If coming from home page, do a search for this gene
            backUrl = `/?query=${encodeURIComponent(symbol)}`;
        } else {
            backUrl = referer;
        }
    } else {
        // No referer, default to gene search
        backUrl = `/?query=${encodeURIComponent(symbol)}`;
    }
    
    db.all('SELECT rowid, * FROM genome_crispr WHERE symbol = ? ORDER BY cellline, start', [symbol], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.render('gene-overview', { 
                error: 'Database error occurred', 
                gene: null,
                backUrl: backUrl
            });
        }
        
        if (!rows || rows.length === 0) {
            return res.render('gene-overview', { 
                error: 'Gene not found', 
                gene: null,
                backUrl: backUrl
            });
        }

        // Create GeneView from all rows
        const geneView = GeneView.fromDbRows(rows);

        res.render('gene-overview', { 
            gene: geneView.toJSON(), 
            error: null,
            backUrl: backUrl
        });
    });
});

// RESTful API Routes
// ===================

// GET /api/records - Get all records with pagination and filtering
app.get('/api/records', (req, res) => {
    try {
        const searchQuery = req.query.query || '';
        const strand = req.query.strand || '';
        const effect = req.query.effect || '';
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 25, 1000); // Max 1000 records per request
        const sortBy = req.query.sortBy || 'rowid';
        const sortOrder = req.query.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const offset = (page - 1) * limit;

        // Validate sortBy parameter to prevent SQL injection
        const allowedSortFields = ['rowid', 'chr', 'start', 'end', 'strand', 'symbol', 'ensg', 'log2fc', 'effect', 'cellline'];
        if (!allowedSortFields.includes(sortBy)) {
            return res.status(400).json({ 
                error: 'Invalid sort field',
                allowedFields: allowedSortFields 
            });
        }

        // Build the search conditions using the existing function
        const { query, countQuery, params } = buildSearchQuery({
            query: searchQuery,
            strand: strand,
            effect: effect
        }, {
            page, limit, sortBy, sortOrder
        });

        // Count total results
        db.get(countQuery, params, (err, countResult) => {
            if (err) {
                console.error('API Error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            const totalResults = countResult.total || countResult.count;
            const totalPages = Math.ceil(totalResults / limit);

            // Get paginated results
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('API Error:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                // Format results using Gene model
                const formattedResults = rows.map(row => {
                    const gene = Gene.fromDbRow({
                        ...row,
                        id: row.rowid // Map rowid to id for the model
                    });
                    return gene.toJSON();
                });

                res.json({
                    data: formattedResults,
                    pagination: {
                        currentPage: page,
                        totalPages: totalPages,
                        totalResults: totalResults,
                        limit: limit,
                        hasNext: page < totalPages,
                        hasPrev: page > 1
                    },
                    filters: {
                        query: searchQuery,
                        strand: strand,
                        effect: effect,
                        sortBy: sortBy,
                        sortOrder: sortOrder
                    }
                });
            });
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/records/:id - Get a specific record by ID
app.get('/api/records/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid record ID' });
        }
        
        db.get('SELECT rowid, * FROM genome_crispr WHERE rowid = ?', [id], (err, row) => {
            if (err) {
                console.error('API Error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            if (!row) {
                return res.status(404).json({ error: 'Record not found' });
            }
            
            // Format the record using Gene model
            const gene = Gene.fromDbRow({
                ...row,
                id: row.rowid // Map rowid to id for the model
            });
            const formattedRecord = gene.toJSON();
            
            res.json({ data: formattedRecord });
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats - Get database statistics
app.get('/api/stats', (req, res) => {
    try {
        // Total records
        db.get('SELECT COUNT(*) as count FROM genome_crispr', (err, totalResult) => {
            if (err) {
                console.error('API Error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            const totalRecords = totalResult.count;
            
            // Records by chromosome
            db.all(`SELECT chr, COUNT(*) as count FROM genome_crispr GROUP BY chr ORDER BY chr`, (err, chromosomeStats) => {
                if (err) {
                    console.error('API Error:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                
                // Records by strand
                db.all(`SELECT strand, COUNT(*) as count FROM genome_crispr WHERE strand IS NOT NULL AND strand != '' GROUP BY strand`, (err, strandStats) => {
                    if (err) {
                        console.error('API Error:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }
                    
                    // Records by effect
                    db.all(`SELECT effect, COUNT(*) as count FROM genome_crispr WHERE effect IS NOT NULL AND effect != '' GROUP BY effect ORDER BY count DESC`, (err, effectStats) => {
                        if (err) {
                            console.error('API Error:', err);
                            return res.status(500).json({ error: 'Internal server error' });
                        }
                        
                        // Cell line stats
                        db.all(`SELECT cellline, COUNT(*) as count FROM genome_crispr WHERE cellline IS NOT NULL AND cellline != '' GROUP BY cellline ORDER BY count DESC LIMIT 10`, (err, cellLineStats) => {
                            if (err) {
                                console.error('API Error:', err);
                                return res.status(500).json({ error: 'Internal server error' });
                            }
                            
                            res.json({
                                totalRecords,
                                chromosomes: chromosomeStats,
                                strands: strandStats,
                                effects: effectStats,
                                topCellLines: cellLineStats
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/search/suggest - Get search suggestions
app.get('/api/search/suggest', (req, res) => {
    try {
        const query = req.query.q || '';
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        
        if (query.length < 2) {
            return res.json({ suggestions: [] });
        }
        
        // Search for gene symbols and ENSG IDs
        db.all(`
            SELECT DISTINCT symbol as value, 'gene_symbol' as type
            FROM genome_crispr 
            WHERE symbol LIKE ? AND symbol IS NOT NULL
            UNION
            SELECT DISTINCT ensg as value, 'ensg_id' as type
            FROM genome_crispr 
            WHERE ensg LIKE ? AND ensg IS NOT NULL
            UNION
            SELECT DISTINCT chr as value, 'chromosome' as type
            FROM genome_crispr 
            WHERE chr LIKE ? AND chr IS NOT NULL
            ORDER BY value
            LIMIT ?
        `, [
            `${query}%`,
            `${query}%`, 
            `${query}%`,
            limit
        ], (err, suggestions) => {
            if (err) {
                console.error('API Error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            res.json({ suggestions });
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export - Export search results as CSV or JSON
app.get('/api/export', (req, res) => {
    try {
        const searchQuery = req.query.query || '';
        const strand = req.query.strand || '';
        const effect = req.query.effect || '';
        const format = req.query.format || 'csv';
        const limit = Math.min(parseInt(req.query.limit) || 10000, 50000); // Max 50k for export
        
        if (format !== 'csv' && format !== 'json') {
            return res.status(400).json({ error: 'Invalid format. Supported: csv, json' });
        }
        
        // Build search query
        const { query, params } = buildSearchQuery({
            query: searchQuery,
            strand: strand,
            effect: effect
        }, {
            page: 1, 
            limit: limit, 
            sortBy: 'rowid', 
            sortOrder: 'ASC'
        });
        
        // Get results (limited for performance)
        db.all(query, params, (err, results) => {
            if (err) {
                console.error('API Error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            if (format === 'csv') {
                // Generate CSV
                const headers = ['ID', 'Chromosome', 'Start', 'End', 'Strand', 'Symbol', 'ENSG', 'Log2FC', 'Effect', 'Cell_Line', 'Condition', 'Sequence', 'PubMed', 'CAS', 'Screen_Type', 'RC_Initial', 'RC_Final'];
                const csvContent = [
                    headers.join(','),
                    ...results.map(row => [
                        row.rowid,
                        row.chr,
                        row.start,
                        row.end,
                        row.strand,
                        `"${(row.symbol || '').replace(/"/g, '""')}"`,
                        row.ensg,
                        row.log2fc,
                        `"${(row.effect || '').replace(/"/g, '""')}"`,
                        `"${(row.cellline || '').replace(/"/g, '""')}"`,
                        `"${(row.condition || '').replace(/"/g, '""')}"`,
                        `"${(row.sequence || '').replace(/"/g, '""')}"`,
                        row.pubmed,
                        row.cas,
                        `"${(row.screentype || '').replace(/"/g, '""')}"`,
                        row.rc_initial,
                        row.rc_final
                    ].join(','))
                ].join('\n');
                
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="genome_crispr_export.csv"');
                res.send(csvContent);
            } else {
                // Return JSON format using Gene model
                const formattedResults = results.map(row => {
                    const gene = Gene.fromDbRow({
                        ...row,
                        id: row.rowid // Map rowid to id for the model
                    });
                    return gene.toJSON();
                });
                
                res.json({ 
                    data: formattedResults,
                    metadata: {
                        exportDate: new Date().toISOString(),
                        totalRecords: results.length,
                        filters: { query: searchQuery, strand, effect }
                    }
                });
            }
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint for AJAX requests (keeping for compatibility)
// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});