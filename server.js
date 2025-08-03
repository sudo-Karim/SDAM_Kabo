const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { buildSearchQuery } = require('./searchArg');
const { 
    renderIndexError, renderIndexSuccess, formatGenesFromRows, 
    handleApiError, parseQueryParams, validateSortBy 
} = require('./utils/responseHelpers');

const { GeneView } = require('./model/GeneView');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors(), express.urlencoded({ extended: true }), express.json());
app.use((req, res, next) => { console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`); next(); });

// Configure EJS and static files
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'frontend'));
app.use('/css', express.static(path.join(__dirname, 'frontend/css')));

// Database connection
const db = new sqlite3.Database('./genome_crispr.db', (err) => {
    if (err) console.error('Error opening database:', err.message);
    else console.log('Connected to the SQLite database.');
});

// Helper function to determine if search should use gene view
function shouldUseGeneView(searchQuery) {
    // Always use gene view for any non-empty search query
    return searchQuery && searchQuery.trim().length > 0;
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
    const params = parseQueryParams(req.query);

    if (!params.searchQuery) {
        return renderIndexSuccess(res, req, {
            results: [], totalRows: 0, currentPage: 1, totalPages: 0,
            itemsPerPage: 10, sortBy: 'rowid', sortOrder: 'ASC',
            hasSearch: false, isGeneView: false
        });
    }

    if (shouldUseGeneView(params.searchQuery)) {
        getGeneViewResults(params.searchQuery, null, null, params.page, params.limit, params.sortBy, params.sortOrder, (err, result) => {
            if (err) {
                return renderIndexError(res, req, 'Database error occurred', {
                    itemsPerPage: params.limit, sortBy: params.sortBy, sortOrder: params.sortOrder, hasSearch: true
                });
            }
            
            renderIndexSuccess(res, req, {
                results: result.results, totalRows: result.totalRows, currentPage: params.page,
                totalPages: result.totalPages, itemsPerPage: params.limit, sortBy: params.sortBy,
                sortOrder: params.sortOrder, hasSearch: true, isGeneView: true
            });
        });
    } else {
        const { query, countQuery, params: searchParams } = buildSearchQuery(req.query, params);

        db.get(countQuery, searchParams, (err, countResult) => {
            if (err) {
                return renderIndexError(res, req, 'Database error occurred', {
                    itemsPerPage: params.limit, sortBy: params.sortBy, sortOrder: params.sortOrder, hasSearch: false
                });
            }

            const totalRows = countResult.total || countResult.count;
            const totalPages = Math.ceil(totalRows / params.limit);

            db.all(query, searchParams, (err, rows) => {
                if (err) {
                    return renderIndexError(res, req, 'Database error occurred', {
                        itemsPerPage: params.limit, sortBy: params.sortBy, sortOrder: params.sortOrder, hasSearch: true
                    });
                }

                renderIndexSuccess(res, req, {
                    results: formatGenesFromRows(rows), totalRows, currentPage: params.page,
                    totalPages, itemsPerPage: params.limit, sortBy: params.sortBy,
                    sortOrder: params.sortOrder, hasSearch: true, isGeneView: false
                });
            });
        });
    }
});

// Details page route
app.get('/details/:id', (req, res) => {
    db.get('SELECT rowid, * FROM genome_crispr WHERE rowid = ?', [req.params.id], (err, row) => {
        let backUrl = '/';
        const referer = req.get('Referer');
        
        // If coming from a search results page, go back to that
        if (referer && referer.includes('/?')) {
            backUrl = referer;
        } 
        // If coming from gene overview, go to search for that gene
        else if (referer && referer.includes('/gene/')) {
            const symbol = row?.symbol;
            backUrl = symbol ? `/?query=${encodeURIComponent(symbol)}` : '/';
        }
        // Default fallback
        else {
            backUrl = '/';
        }
        
        if (err) return res.render('details', { error: 'Database error occurred', data: null, backUrl });
        if (!row) return res.render('details', { error: 'Record not found', data: null, backUrl });

        const data = require('./utils/responseHelpers').formatGeneFromRow({ ...row, id: row.rowid });
        res.render('details', { data, error: null, backUrl });
    });
});

// Gene overview route
app.get('/gene/:symbol', (req, res) => {
    const symbol = req.params.symbol;
    const referer = req.get('Referer');
    
    // Always go back to search results for this gene, not to the referer
    // This prevents loops between gene overview and details pages
    let backUrl = `/?query=${encodeURIComponent(symbol)}`;
    
    // Only if referer is the main search page with parameters, use that
    if (referer && referer.includes('/?') && referer.includes('query=')) {
        backUrl = referer;
    }
    
    db.all('SELECT rowid, * FROM genome_crispr WHERE symbol = ? ORDER BY cellline, start', [symbol], (err, rows) => {
        if (err) return res.render('gene-overview', { error: 'Database error occurred', gene: null, backUrl });
        if (!rows || rows.length === 0) return res.render('gene-overview', { error: 'Gene not found', gene: null, backUrl });

        const geneView = GeneView.fromDbRows(rows);
        res.render('gene-overview', { gene: geneView.toJSON(), error: null, backUrl });
    });
});

// RESTful API Routes
// ===================

// GET /api/records - Get all records with pagination and filtering
app.get('/api/records', (req, res) => {
    try {
        const params = parseQueryParams(req.query);
        
        if (!validateSortBy(params.sortBy)) {
            return res.status(400).json({ 
                error: 'Invalid sort field',
                allowedFields: ['rowid', 'chr', 'start', 'end', 'strand', 'symbol', 'ensg', 'log2fc', 'effect', 'cellline']
            });
        }

        // Use gene view logic for gene searches (consistent with main route)
        if (params.searchQuery && shouldUseGeneView(params.searchQuery)) {
            getGeneViewResults(params.searchQuery, null, null, params.page, params.limit, params.sortBy, params.sortOrder, (err, result) => {
                if (err) return handleApiError(res, err);

                res.json({
                    data: result.results,
                    pagination: {
                        currentPage: params.page,
                        totalPages: result.totalPages,
                        totalResults: result.totalRows,
                        limit: params.limit,
                        hasNext: params.page < result.totalPages,
                        hasPrev: params.page > 1
                    },
                    filters: {
                        query: params.searchQuery,
                        strand: params.strand,
                        effect: params.effect,
                        sortBy: params.sortBy,
                        sortOrder: params.sortOrder
                    }
                });
            });
        } else {
            const { query, countQuery, searchParams } = buildSearchQuery(req.query, params);

            // Get count and data
            db.get(countQuery, searchParams, (err, countResult) => {
                if (err) return handleApiError(res, err);

                const totalResults = countResult.total || countResult.count;
                const totalPages = Math.ceil(totalResults / params.limit);

                db.all(query, searchParams, (err, rows) => {
                    if (err) return handleApiError(res, err);

                    res.json({
                        data: formatGenesFromRows(rows),
                        pagination: {
                            currentPage: params.page,
                            totalPages,
                            totalResults,
                            limit: params.limit,
                            hasNext: params.page < totalPages,
                            hasPrev: params.page > 1
                        },
                        filters: {
                            query: params.searchQuery,
                            strand: params.strand,
                            effect: params.effect,
                            sortBy: params.sortBy,
                            sortOrder: params.sortOrder
                        }
                    });
                });
            });
        }
    } catch (error) {
        handleApiError(res, error);
    }
});

// GET /api/records/:id - Get a specific record by ID
app.get('/api/records/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid record ID' });
    }
    
    db.get('SELECT rowid, * FROM genome_crispr WHERE rowid = ?', [id], (err, row) => {
        if (err) return handleApiError(res, err);
        if (!row) return res.status(404).json({ error: 'Record not found' });
        
        const formattedRecord = require('./utils/responseHelpers').formatGeneFromRow({
            ...row,
            id: row.rowid
        });
        
        res.json({ data: formattedRecord });
    });
});

// GET /api/stats - Get database statistics
app.get('/api/stats', (req, res) => {
    const queries = {
        total: 'SELECT COUNT(*) as count FROM genome_crispr',
        chromosomes: 'SELECT chr, COUNT(*) as count FROM genome_crispr GROUP BY chr ORDER BY chr',
        strands: 'SELECT strand, COUNT(*) as count FROM genome_crispr WHERE strand IS NOT NULL AND strand != "" GROUP BY strand',
        effects: 'SELECT effect, COUNT(*) as count FROM genome_crispr WHERE effect IS NOT NULL AND effect != "" GROUP BY effect ORDER BY count DESC',
        cellLines: 'SELECT cellline, COUNT(*) as count FROM genome_crispr WHERE cellline IS NOT NULL AND cellline != "" GROUP BY cellline ORDER BY count DESC LIMIT 10'
    };

    const results = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
        db.all(query, (err, rows) => {
            if (err) return handleApiError(res, err);
            
            results[key] = key === 'total' ? rows[0].count : rows;
            completed++;
            
            if (completed === total) {
                res.json({
                    totalRecords: results.total,
                    chromosomes: results.chromosomes,
                    strands: results.strands,
                    effects: results.effects,
                    topCellLines: results.cellLines
                });
            }
        });
    });
});

// GET /api/search/suggest - Get search suggestions
app.get('/api/search/suggest', (req, res) => {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    
    if (query.length < 2) return res.json({ suggestions: [] });
    
    db.all(`
        SELECT DISTINCT symbol as value, 'gene_symbol' as type FROM genome_crispr WHERE symbol LIKE ? AND symbol IS NOT NULL
        UNION SELECT DISTINCT ensg as value, 'ensg_id' as type FROM genome_crispr WHERE ensg LIKE ? AND ensg IS NOT NULL
        ORDER BY value LIMIT ?
    `, [`${query}%`, `${query}%`, limit], (err, suggestions) => {
        if (err) return handleApiError(res, err);
        res.json({ suggestions });
    });
});

// GET /api/export - Export search results as JSON
app.get('/api/export', (req, res) => {
    const params = parseQueryParams(req.query);
    const limit = Math.min(parseInt(req.query.limit) || 10000, 50000);
    
    const { query, params: searchParams } = buildSearchQuery({
        query: params.searchQuery,
        strand: params.strand,
        effect: params.effect
    }, { page: 1, limit, sortBy: 'rowid', sortOrder: 'ASC' });
    
    db.all(query, searchParams, (err, results) => {
        if (err) return handleApiError(res, err);
        
        res.json({ 
            data: formatGenesFromRows(results),
            metadata: {
                exportDate: new Date().toISOString(),
                totalRecords: results.length,
                filters: { query: params.searchQuery, strand: params.strand, effect: params.effect }
            }
        });
    });
});

// Start server and handle graceful shutdown
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
process.on('SIGINT', () => db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    else console.log('Database connection closed.');
    process.exit(0);
}));