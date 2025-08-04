const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { 
    renderIndexError, renderIndexSuccess, formatGeneFromRow,
    handleApiError, parseQueryParams, validateSortBy 
} = require('./utils/responseHelpers');

const Gene = require('./model/Gene');
const GeneView = require('./model/GeneView');

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

// Helper function to get gene search results using optimized relational queries
function searchGenesWithPagination(searchQuery, page, limit, sortBy, sortOrder, callback) {
    Gene.searchGenes(db, searchQuery, { page, limit, sortBy, sortOrder }, callback);
}



// Main route - handles both search and initial page load
app.get('/', (req, res) => {
    const params = parseQueryParams(req.query);

    if (!params.searchQuery) {
        return renderIndexSuccess(res, req, {
            results: [], totalRows: 0, currentPage: 1, totalPages: 0,
            itemsPerPage: 10, sortBy: 'rowid', sortOrder: 'ASC',
            hasSearch: false
        });
    }

    // Use optimized Gene model for all searches
    searchGenesWithPagination(params.searchQuery, params.page, params.limit, params.sortBy, params.sortOrder, (err, result) => {
        if (err) {
            return renderIndexError(res, req, 'Database error occurred', {
                itemsPerPage: params.limit, sortBy: params.sortBy, sortOrder: params.sortOrder, hasSearch: true
            });
        }

        renderIndexSuccess(res, req, {
            results: result.results, totalRows: result.totalRows, currentPage: params.page,
            totalPages: result.totalPages, itemsPerPage: params.limit, sortBy: params.sortBy,
            sortOrder: params.sortOrder, hasSearch: true
        });
    });
});

// Details page route
app.get('/details/:id', (req, res) => {
    db.get('SELECT rowid, * FROM genome_crispr WHERE rowid = ?', [req.params.id], (err, row) => {
        if (err) return res.render('details', { error: 'Database error occurred', data: null });
        if (!row) return res.render('details', { error: 'Record not found', data: null });

        const data = formatGeneFromRow({ ...row, id: row.rowid });
        res.render('details', { data, error: null });
    });
});

// Gene overview route using optimized relational queries with frontend compatibility
app.get('/gene/:symbol', (req, res) => {
    const symbol = req.params.symbol;
    
    Gene.loadWithRelations(db, symbol, (err, gene) => {
        if (err) return res.render('gene-overview', { error: 'Database error occurred', gene: null });
        if (!gene) return res.render('gene-overview', { error: 'Gene not found', gene: null });

        // Convert to GeneView for frontend template compatibility
        const geneView = GeneView.fromGeneModel(gene.toJSON());
        res.render('gene-overview', { gene: geneView.toJSON(), error: null });
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
        if (params.searchQuery) {
            searchGenesWithPagination(params.searchQuery, params.page, params.limit, params.sortBy, params.sortOrder, (err, result) => {
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
            // No search query, return empty results
            res.json({
                data: [],
                pagination: {
                    currentPage: 1,
                    totalPages: 0,
                    totalResults: 0,
                    limit: params.limit,
                    hasNext: false,
                    hasPrev: false
                },
                filters: {
                    query: '',
                    strand: params.strand,
                    effect: params.effect,
                    sortBy: params.sortBy,
                    sortOrder: params.sortOrder
                }
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

// GET /api/stats - Get database statistics using optimized relational queries
app.get('/api/stats', (req, res) => {
    const queries = {
        total: 'SELECT COUNT(*) as count FROM sgrnas',
        genes: 'SELECT COUNT(*) as count FROM genes',
        chromosomes: 'SELECT g.chr, COUNT(s.sgrna_id) as count FROM genes g JOIN experiments e ON g.gene_id = e.gene_id JOIN sgrnas s ON e.experiment_id = s.experiment_id GROUP BY g.chr ORDER BY g.chr',
        effects: 'SELECT s.effect, COUNT(*) as count FROM sgrnas s WHERE s.effect IS NOT NULL AND s.effect != "" GROUP BY s.effect ORDER BY count DESC',
        cellLines: 'SELECT cl.name as cellline, COUNT(s.sgrna_id) as count FROM cell_lines cl JOIN experiments e ON cl.cellline_id = e.cellline_id JOIN sgrnas s ON e.experiment_id = s.experiment_id GROUP BY cl.name ORDER BY count DESC LIMIT 10'
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
    
    if (!params.searchQuery) {
        return res.json({ 
            data: [],
            metadata: {
                exportDate: new Date().toISOString(),
                totalRecords: 0,
                filters: { query: '', strand: params.strand, effect: params.effect }
            }
        });
    }
    
    // Use optimized Gene model for export
    searchGenesWithPagination(params.searchQuery, 1, limit, 'symbol', 'ASC', (err, result) => {
        if (err) return handleApiError(res, err);
        
        res.json({ 
            data: result.results,
            metadata: {
                exportDate: new Date().toISOString(),
                totalRecords: result.results.length,
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