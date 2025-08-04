/**
 * Response helper functions to reduce code duplication
 */

const Gene = require('../model/Gene');

/**
 * Standard error response for index page
 */
function renderIndexError(res, req, error, options = {}) {
    const defaults = {
        results: [], totalRows: 0, currentPage: 1, totalPages: 0,
        itemsPerPage: 10, sortBy: 'rowid', sortOrder: 'ASC',
        hasSearch: false
    };
    
    res.render('index', {
        ...defaults, ...options, error,
        searchQuery: req.query.query || '',
        strand: req.query.strand || '',
        effect: req.query.effect || ''
    });
}

/**
 * Standard success response for index page
 */
function renderIndexSuccess(res, req, data) {
    res.render('index', {
        ...data, error: null,
        searchQuery: req.query.query || '',
        strand: req.query.strand || '',
        effect: req.query.effect || ''
    });
}

/**
 * Format database row using Gene model
 */
function formatGeneFromRow(row) {
    return Gene.fromDbRow({ ...row, id: row.rowid }).toJSON();
}

/**
 * Handle database/API errors consistently
 */
function handleApiError(res, err, message = 'Internal server error') {
    console.error('Error:', err);
    return res.status(500).json({ error: message });
}

/**
 * Validate and parse common query parameters
 */
function parseQueryParams(query) {
    return {
        searchQuery: query.query || '',
        strand: query.strand || '',
        effect: query.effect || '',
        page: parseInt(query.page) || 1,
        limit: Math.min(parseInt(query.limit) || 25, 1000),
        sortBy: query.sortBy || 'rowid',
        sortOrder: query.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    };
}

/**
 * Validate sortBy parameter
 */
function validateSortBy(sortBy) {
    const allowedFields = ['rowid', 'chr', 'start', 'end', 'strand', 'symbol', 'ensg', 'log2fc', 'effect', 'cellline'];
    return allowedFields.includes(sortBy);
}

module.exports = {
    renderIndexError,
    renderIndexSuccess,
    formatGeneFromRow,
    handleApiError,
    parseQueryParams,
    validateSortBy
};
