/**
 * Search argument parsing and SQL query building for genomic data
 */

/**
 * Internal helper class for building search conditions
 * @private
 */
class SearchArguments {
    constructor() {
        this.conditions = [];
        this.params = [];
    }

    /**
     * Add a search condition
     * @param {string} condition - SQL condition string with placeholder
     * @param {any} value - Parameter value
     */
    addCondition(condition, value) {
        this.conditions.push(condition);
        this.params.push(value);
        return this;
    }

    /**
     * Build the WHERE clause
     * @returns {string} SQL WHERE clause
     */
    buildWhereClause() {
        if (this.conditions.length === 0) {
            return '';
        }
        return ' WHERE ' + this.conditions.join(' AND ');
    }

    /**
     * Get all parameters
     * @returns {Array} Array of parameter values
     */
    getParams() {
        return this.params;
    }

    /**
     * Reset all conditions and parameters
     */
    reset() {
        this.conditions = [];
        this.params = [];
        return this;
    }
}

/**
 * Parse search query parameters and build SQL conditions
 * @param {Object} queryParams - Express request query parameters
 * @returns {SearchArguments} SearchArguments instance with built conditions
 */
function parseSearchQuery(queryParams) {
    const searchArgs = new SearchArguments();

    // Gene symbol or ENSG ID search only
    if (queryParams.query && queryParams.query.trim()) {
        const query = `%${queryParams.query.trim()}%`;
        searchArgs.addCondition(
            '(symbol LIKE ? OR ensg LIKE ?)',
            query
        );
        // Add the same parameter for the second LIKE clause
        searchArgs.params.push(query);
    }

    // Chromosome filter
    if (queryParams.chr && queryParams.chr.trim()) {
        searchArgs.addCondition('chr = ?', queryParams.chr.trim());
    }

    // Strand filter
    if (queryParams.strand && (queryParams.strand === '+' || queryParams.strand === '-')) {
        searchArgs.addCondition('strand = ?', queryParams.strand);
    }

    // Effect filter (based on log2fc value)
    if (queryParams.effect) {
        if (queryParams.effect === 'up') {
            searchArgs.addCondition('CAST(log2fc AS REAL) > ?', 0);
        } else if (queryParams.effect === 'down') {
            searchArgs.addCondition('CAST(log2fc AS REAL) < ?', 0);
        }
    }

    // Cell line filter (still used for legacy flat table queries)
    if (queryParams.cellline && queryParams.cellline.trim()) {
        searchArgs.addCondition('cellline LIKE ?', `%${queryParams.cellline.trim()}%`);
    }

    return searchArgs;
}

/**
 * Build a complete SQL query with search conditions, pagination, and sorting
 * @param {Object} queryParams - Express request query parameters
 * @param {Object} options - Additional options like pagination
 * @returns {Object} Object containing SQL query and parameters
 */
function buildSearchQuery(queryParams, options = {}) {
    const searchArgs = parseSearchQuery(queryParams);
    const { page = 1, limit = 50, sortBy = 'start', sortOrder = 'ASC' } = options;
    
    const offset = (page - 1) * limit;
    
    // Validate sort column to prevent SQL injection
    const validSortColumns = ['rowid', 'start', 'end', 'chr', 'strand', 'symbol', 'ensg', 'log2fc', 'effect', 'cellline', 'condition'];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'rowid';
    const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
    
    // Build the main query
    const baseQuery = 'SELECT rowid, * FROM genome_crispr';
    const whereClause = searchArgs.buildWhereClause();
    const orderClause = ` ORDER BY ${safeSortBy} ${safeSortOrder}`;
    const limitClause = ` LIMIT ${limit} OFFSET ${offset}`;
    
    const query = baseQuery + whereClause + orderClause + limitClause;
    
    // Build count query for pagination
    const countQuery = 'SELECT COUNT(*) as count FROM genome_crispr' + whereClause;
    
    return {
        query,
        countQuery,
        params: searchArgs.getParams()
    };
}

module.exports = {
    buildSearchQuery
};
