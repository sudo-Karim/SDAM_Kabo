/**
 * Gene model for genomic data
 */

const BaseModel = require('./BaseModel');

class Gene extends BaseModel {
    constructor(data) {
        super(data);
        this.id = data.id || data.rowid; // Handle both id and rowid
    }

    /**
     * Calculate the midpoint of the gene segment
     * @returns {number} Midpoint position
     */
    getMidpoint() {
        const start = this.parseInt(this.start);
        const end = this.parseInt(this.end);
        return (start !== null && end !== null) ? Math.floor((start + end) / 2) : null;
    }

    /**
     * Calculate the length of the gene segment
     * @returns {number} Length in base pairs
     */
    getLength() {
        const start = this.parseInt(this.start);
        const end = this.parseInt(this.end);
        return (start !== null && end !== null) ? Math.abs(end - start) + 1 : null;
    }

    /**
     * Check if this is an upregulated gene
     * @returns {boolean} True if upregulated
     */
    isUpregulated() {
        return this.parseNumber(this.log2fc) > 0;
    }

    /**
     * Check if this is a downregulated gene
     * @returns {boolean} True if downregulated
     */
    isDownregulated() {
        return parseFloat(this.log2fc) < 0;
    }

    /**
     * Get the fold change value (not log2)
     * @returns {number} Fold change
     */
    getFoldChange() {
        const log2fc = parseFloat(this.log2fc);
        return isNaN(log2fc) ? null : Math.pow(2, log2fc);
    }

    /**
     * Format the gene for API response
     * @returns {Object} Formatted gene object
     */
    toJSON() {
        return {
            id: this.id,
            start: this.start,
            end: this.end,
            chr: this.chr,
            strand: this.strand,
            pubmed: this.pubmed,
            cellline: this.cellline,
            condition: this.condition,
            sequence: this.sequence,
            symbol: this.symbol,
            ensg: this.ensg,
            log2fc: parseFloat(this.log2fc),
            rc_initial: this.rc_initial,
            rc_final: this.rc_final,
            effect: this.effect,
            cas: this.cas,
            screentype: this.screentype,
            midpoint: this.getMidpoint(),
            length: this.getLength(),
            foldChange: this.getFoldChange()
        };
    }

    /**
     * Create a Gene instance from database row
     * @param {Object} row - Database row object
     * @returns {Gene} Gene instance
     */
    static fromDbRow(row) {
        return new Gene(row);
    }
}

module.exports = Gene;
