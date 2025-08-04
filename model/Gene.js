/**
 * Enhanced Gene model for relational genomic data
 * Optimized for normalized database structure
 */

const BaseModel = require('./BaseModel');

class Gene extends BaseModel {
    constructor(data) {
        super(data);
        this.id = data.gene_id || data.id || data.rowid;
        this.experiments = data.experiments || [];
        this._stats = null; // Cached statistics
    }

    /**
     * Calculate total sgRNA count across all experiments
     * @returns {number} Total sgRNA count
     */
    getTotalSgRNACount() {
        if (!this._stats) this._calculateStats();
        return this._stats.totalSgRNAs;
    }

    /**
     * Calculate average effect across all sgRNAs
     * @returns {number} Average log2fc
     */
    getAverageEffect() {
        if (!this._stats) this._calculateStats();
        return this._stats.averageEffect;
    }

    /**
     * Get genomic range across all sgRNAs
     * @returns {Object} {start, end} coordinates
     */
    getGenomicRange() {
        if (!this._stats) this._calculateStats();
        return this._stats.genomicRange;
    }

    /**
     * Calculate cached statistics from experiments
     * @private
     */
    _calculateStats() {
        let totalSgRNAs = 0;
        let totalEffect = 0;
        let effectCount = 0;
        let minStart = Infinity;
        let maxEnd = -Infinity;

        this.experiments.forEach(exp => {
            if (exp.sgRNAs) {
                totalSgRNAs += exp.sgRNAs.length;
                exp.sgRNAs.forEach(sgRNA => {
                    const log2fc = parseFloat(sgRNA.log2fc);
                    if (!isNaN(log2fc)) {
                        totalEffect += log2fc;
                        effectCount++;
                    }
                    
                    const start = parseInt(sgRNA.start_pos || sgRNA.start);
                    const end = parseInt(sgRNA.end_pos || sgRNA.end);
                    if (!isNaN(start)) minStart = Math.min(minStart, start);
                    if (!isNaN(end)) maxEnd = Math.max(maxEnd, end);
                });
            }
        });

        this._stats = {
            totalSgRNAs,
            averageEffect: effectCount > 0 ? totalEffect / effectCount : null,
            genomicRange: {
                start: minStart === Infinity ? null : minStart,
                end: maxEnd === -Infinity ? null : maxEnd
            }
        };
    }

    /**
     * Enhanced JSON serialization for API responses
     * @returns {Object} Complete gene representation
     */
    toJSON() {
        const range = this.getGenomicRange();
        return {
            id: this.id,
            symbol: this.symbol,
            ensg: this.ensg,
            chr: this.chr,
            totalSgRNAs: this.getTotalSgRNACount(),
            averageEffect: this.getAverageEffect(),
            experimentCount: this.experiments.length,
            cellLineCount: this.cellLineCount || 0,
            genomicRange: range,
            experiments: this.experiments.map(exp => ({
                cellline: exp.name || exp.cellline,
                condition: exp.condition,
                cas: exp.cas,
                screentype: exp.screentype,
                pubmed: exp.pubmed,
                sgRNACount: exp.sgRNAs ? exp.sgRNAs.length : 0,
                averageEffect: exp.averageEffect,
                sgRNAs: exp.sgRNAs ? exp.sgRNAs.map(sg => ({
                    id: sg.sgrna_id || sg.id,
                    sequence: sg.sequence,
                    start: sg.start_pos || sg.start,
                    end: sg.end_pos || sg.end,
                    strand: sg.strand,
                    log2fc: parseFloat(sg.log2fc),
                    effect: sg.effect,
                    rc_initial: sg.rc_initial,
                    rc_final: sg.rc_final,
                    midpoint: this._calculateMidpoint(sg.start_pos || sg.start, sg.end_pos || sg.end),
                    length: this._calculateLength(sg.start_pos || sg.start, sg.end_pos || sg.end),
                    foldChange: sg.log2fc ? Math.pow(2, parseFloat(sg.log2fc)) : null
                })) : []
            }))
        };
    }

    /**
     * Calculate midpoint and length for sgRNA
     * @private
     */
    _calculateMidpoint(start, end) {
        const s = parseInt(start);
        const e = parseInt(end);
        return (!isNaN(s) && !isNaN(e)) ? Math.floor((s + e) / 2) : null;
    }

    _calculateLength(start, end) {
        const s = parseInt(start);
        const e = parseInt(end);
        return (!isNaN(s) && !isNaN(e)) ? Math.abs(e - s) + 1 : null;
    }

    /**
     * Load gene with relational data from database
     * @param {Object} db - Database connection
     * @param {string} symbol - Gene symbol
     * @param {Function} callback - Callback function
     */
    static loadWithRelations(db, symbol, callback) {
        const query = `
            SELECT 
                g.gene_id, g.symbol, g.ensg, g.chr,
                e.experiment_id, cl.name as cellline, e.condition, e.cas, e.screentype, e.pubmed,
                s.sgrna_id, s.sequence, s.start_pos, s.end_pos, s.strand, s.log2fc, s.effect, s.rc_initial, s.rc_final
            FROM genes g
            JOIN experiments e ON g.gene_id = e.gene_id
            JOIN cell_lines cl ON e.cellline_id = cl.cellline_id
            JOIN sgrnas s ON e.experiment_id = s.experiment_id
            WHERE g.symbol = ?
            ORDER BY cl.name, s.start_pos
        `;

        db.all(query, [symbol], (err, rows) => {
            if (err) return callback(err, null);
            if (rows.length === 0) return callback(null, null);

            const gene = new Gene(rows[0]);
            const experimentsMap = new Map();

            rows.forEach(row => {
                const expKey = `${row.cellline}_${row.condition || 'default'}`;
                if (!experimentsMap.has(expKey)) {
                    experimentsMap.set(expKey, {
                        name: row.cellline,
                        condition: row.condition,
                        cas: row.cas,
                        screentype: row.screentype,
                        pubmed: row.pubmed,
                        sgRNAs: []
                    });
                }

                experimentsMap.get(expKey).sgRNAs.push({
                    sgrna_id: row.sgrna_id,
                    sequence: row.sequence,
                    start_pos: row.start_pos,
                    end_pos: row.end_pos,
                    strand: row.strand,
                    log2fc: row.log2fc,
                    effect: row.effect,
                    rc_initial: row.rc_initial,
                    rc_final: row.rc_final
                });
            });

            // Calculate averages for each experiment
            experimentsMap.forEach(exp => {
                const effects = exp.sgRNAs
                    .map(sg => parseFloat(sg.log2fc))
                    .filter(fc => !isNaN(fc));
                exp.averageEffect = effects.length > 0 
                    ? effects.reduce((sum, fc) => sum + fc, 0) / effects.length 
                    : null;
            });

            gene.experiments = Array.from(experimentsMap.values());
            callback(null, gene);
        });
    }

    /**
     * Search genes using optimized relational queries
     * @param {Object} db - Database connection
     * @param {string} searchTerm - Search term
     * @param {Object} options - Pagination options
     * @param {Function} callback - Callback function
     */
    static searchGenes(db, searchTerm, options = {}, callback) {
        const { page = 1, limit = 25, sortBy = 'symbol', sortOrder = 'ASC' } = options;
        const offset = (page - 1) * limit;
        const searchPattern = `%${searchTerm.trim()}%`;

        const allowedSortFields = ['symbol', 'chr', 'total_sgrnas', 'avg_log2fc'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'symbol';

        const geneQuery = `
            SELECT 
                g.gene_id,
                g.symbol,
                g.ensg,
                g.chr,
                COUNT(DISTINCT e.experiment_id) as experiment_count,
                COUNT(DISTINCT cl.cellline_id) as cell_line_count,
                COUNT(s.sgrna_id) as total_sgrnas,
                AVG(s.log2fc) as avg_log2fc,
                MIN(s.start_pos) as min_start,
                MAX(s.end_pos) as max_end
            FROM genes g
            JOIN experiments e ON g.gene_id = e.gene_id
            JOIN cell_lines cl ON e.cellline_id = cl.cellline_id
            JOIN sgrnas s ON e.experiment_id = s.experiment_id
            WHERE g.symbol LIKE ? OR g.ensg LIKE ?
            GROUP BY g.gene_id, g.symbol, g.ensg, g.chr
            ORDER BY ${safeSortBy} ${sortOrder}
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(DISTINCT g.gene_id) as total
            FROM genes g
            WHERE g.symbol LIKE ? OR g.ensg LIKE ?
        `;

        db.get(countQuery, [searchPattern, searchPattern], (err, countResult) => {
            if (err) return callback(err, null);

            db.all(geneQuery, [searchPattern, searchPattern, limit, offset], (err, geneRows) => {
                if (err) return callback(err, null);

                const results = geneRows.map(row => {
                    const gene = new Gene({
                        gene_id: row.gene_id,
                        symbol: row.symbol,
                        ensg: row.ensg,
                        chr: row.chr
                    });

                    // Set cached stats
                    gene._stats = {
                        totalSgRNAs: row.total_sgrnas,
                        averageEffect: row.avg_log2fc,
                        cellLineCount: row.cell_line_count,
                        genomicRange: {
                            start: row.min_start,
                            end: row.max_end
                        }
                    };

                    gene.experiments = []; // Will be populated if needed
                    gene.experimentCount = row.experiment_count;
                    gene.cellLineCount = row.cell_line_count;

                    return gene;
                });

                callback(null, {
                    results: results.map(gene => gene.toJSON()),
                    totalRows: countResult.total,
                    totalPages: Math.ceil(countResult.total / limit)
                });
            });
        });
    }

    /**
     * Create Gene instance from old flat database row (backward compatibility)
     * @param {Object} row - Database row from genome_crispr table
     * @returns {Gene} Gene instance
     */
    static fromDbRow(row) {
        const gene = new Gene({
            gene_id: row.id || row.rowid,
            symbol: row.symbol,
            ensg: row.ensg,
            chr: row.chr
        });

        // Calculate derived properties from the flat row data
        const start = parseInt(row.start);
        const end = parseInt(row.end);
        const log2fc = parseFloat(row.log2fc);

        gene._stats = {
            totalSgRNAs: 1, // Single sgRNA per row in flat structure
            averageEffect: !isNaN(log2fc) ? log2fc : null,
            genomicRange: {
                start: !isNaN(start) ? start : null,
                end: !isNaN(end) ? end : null
            }
        };

        // Add properties expected by details template
        gene.id = row.id || row.rowid;
        gene.start = !isNaN(start) ? start : null;
        gene.end = !isNaN(end) ? end : null;
        gene.strand = row.strand;
        gene.sequence = row.sequence;
        gene.log2fc = !isNaN(log2fc) ? log2fc : null;
        gene.effect = row.effect;
        gene.cellline = row.cellline;
        gene.condition = row.condition;
        gene.cas = row.cas;
        gene.screentype = row.screentype;
        gene.pubmed = row.pubmed;
        gene.rc_initial = row.rc_initial;
        gene.rc_final = row.rc_final;

        // Calculated properties for details template  
        gene.length = row.sequence ? row.sequence.length : ((gene.start && gene.end) ? Math.abs(gene.end - gene.start) + 1 : null);
        gene.midpoint = (gene.start && gene.end) ? Math.floor((gene.start + gene.end) / 2) : null;
        gene.foldChange = !isNaN(log2fc) ? Math.pow(2, log2fc) : null;

        // Override toJSON to include all properties needed by details template
        gene.toJSON = function() {
            return {
                id: this.id,
                symbol: this.symbol,
                ensg: this.ensg,
                chr: this.chr,
                start: this.start,
                end: this.end,
                strand: this.strand,
                sequence: this.sequence,
                log2fc: this.log2fc,
                effect: this.effect,
                cellline: this.cellline,
                condition: this.condition,
                cas: this.cas,
                screentype: this.screentype,
                pubmed: this.pubmed,
                rc_initial: this.rc_initial,
                rc_final: this.rc_final,
                length: this.length,
                midpoint: this.midpoint,
                foldChange: this.foldChange,
                totalSgRNAs: this.getTotalSgRNACount(),
                averageEffect: this.getAverageEffect()
            };
        };

        return gene;
    }
}

module.exports = Gene;
