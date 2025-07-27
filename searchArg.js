/**
 * Search argument parsing and SQL query building for genomic data
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

    // General text search across multiple fields
    if (queryParams.query && queryParams.query.trim()) {
        const query = `%${queryParams.query.trim()}%`;
        searchArgs.addCondition(
            '(symbol LIKE ? OR ensg LIKE ? OR sequence LIKE ? OR cellline LIKE ? OR condition LIKE ?)',
            query
        );
        // Add the same parameter 4 more times for the remaining LIKE clauses
        searchArgs.params.push(query, query, query, query);
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

    // Position range filters
    if (queryParams.startPos && !isNaN(queryParams.startPos)) {
        searchArgs.addCondition('CAST(start AS INTEGER) >= ?', parseInt(queryParams.startPos));
    }

    if (queryParams.endPos && !isNaN(queryParams.endPos)) {
        searchArgs.addCondition('CAST(end AS INTEGER) <= ?', parseInt(queryParams.endPos));
    }

    // Cell line filter
    if (queryParams.cellline && queryParams.cellline.trim()) {
        searchArgs.addCondition('cellline LIKE ?', `%${queryParams.cellline.trim()}%`);
    }

    // Condition filter
    if (queryParams.condition && queryParams.condition.trim()) {
        searchArgs.addCondition('condition LIKE ?', `%${queryParams.condition.trim()}%`);
    }

    // Log2FC range filters
    if (queryParams.minLog2fc && !isNaN(queryParams.minLog2fc)) {
        searchArgs.addCondition('CAST(log2fc AS REAL) >= ?', parseFloat(queryParams.minLog2fc));
    }

    if (queryParams.maxLog2fc && !isNaN(queryParams.maxLog2fc)) {
        searchArgs.addCondition('CAST(log2fc AS REAL) <= ?', parseFloat(queryParams.maxLog2fc));
    }

    // Screen type filter
    if (queryParams.screentype && queryParams.screentype.trim()) {
        searchArgs.addCondition('screentype LIKE ?', `%${queryParams.screentype.trim()}%`);
    }

    // Cas system filter
    if (queryParams.cas && queryParams.cas.trim()) {
        searchArgs.addCondition('cas LIKE ?', `%${queryParams.cas.trim()}%`);
    }

    // PubMed ID filter
    if (queryParams.pubmed && queryParams.pubmed.trim()) {
        searchArgs.addCondition('pubmed = ?', queryParams.pubmed.trim());
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
    SearchArguments,
    parseSearchQuery,
    buildSearchQuery
};
