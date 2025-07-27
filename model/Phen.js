/**
 * Phenotype model for genomic phenotype data
 */

class Phen {
    constructor(data) {
        this.effect = data.effect;
        this.log2fc = data.log2fc;
        this.rc_initial = data.rc_initial;
        this.rc_final = data.rc_final;
    }

    /**
     * Check if this represents a significant effect
     * @param {number} threshold - Log2FC threshold (default: 1)
     * @returns {boolean} True if effect is significant
     */
    isSignificant(threshold = 1) {
        return Math.abs(parseFloat(this.log2fc)) >= threshold;
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
     * Format the phenotype for API response
     * @returns {Object} Formatted phenotype object
     */
    toJSON() {
        return {
            effect: this.effect,
            log2fc: parseFloat(this.log2fc),
            rc_initial: this.rc_initial,
            rc_final: this.rc_final,
            foldChange: this.getFoldChange(),
            isSignificant: this.isSignificant()
        };
    }

    /**
     * Create a Phen instance from database row
     * @param {Object} row - Database row object
     * @returns {Phen} Phen instance
     */
    static fromDbRow(row) {
        return new Phen(row);
    }
}

module.exports = Phen;
