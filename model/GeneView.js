/**
 * GeneView model for hierarchical gene data representation
 */

class GeneView {
    constructor(data) {
        this.symbol = data.symbol;
        this.ensg = data.ensg;
        this.chr = data.chr;
        this.cellLines = new Map(); // Will store CellLineView objects
    }

    /**
     * Add a cell line data to this gene
     * @param {Object} cellLineData - Cell line data
     */
    addCellLine(cellLineData) {
        const cellLineName = cellLineData.cellline;
        
        if (!this.cellLines.has(cellLineName)) {
            this.cellLines.set(cellLineName, new CellLineView({
                name: cellLineName,
                condition: cellLineData.condition,
                cas: cellLineData.cas,
                screentype: cellLineData.screentype,
                pubmed: cellLineData.pubmed
            }));
        }
        
        // Add sgRNA to the cell line
        this.cellLines.get(cellLineName).addSgRNA({
            id: cellLineData.id || cellLineData.rowid,
            sequence: cellLineData.sequence,
            start: cellLineData.start,
            end: cellLineData.end,
            strand: cellLineData.strand,
            log2fc: cellLineData.log2fc,
            effect: cellLineData.effect,
            rc_initial: cellLineData.rc_initial,
            rc_final: cellLineData.rc_final
        });
    }

    /**
     * Get total number of sgRNAs across all cell lines
     * @returns {number} Total sgRNA count
     */
    getTotalSgRNACount() {
        let total = 0;
        for (const cellLine of this.cellLines.values()) {
            total += cellLine.sgRNAs.length;
        }
        return total;
    }

    /**
     * Get average effect across all sgRNAs
     * @returns {number} Average log2fc
     */
    getAverageEffect() {
        let totalEffect = 0;
        let count = 0;
        
        for (const cellLine of this.cellLines.values()) {
            for (const sgRNA of cellLine.sgRNAs) {
                if (sgRNA.log2fc !== null && !isNaN(parseFloat(sgRNA.log2fc))) {
                    totalEffect += parseFloat(sgRNA.log2fc);
                    count++;
                }
            }
        }
        
        return count > 0 ? totalEffect / count : null;
    }

    /**
     * Format the gene view for API response
     * @returns {Object} Formatted gene view object
     */
    toJSON() {
        return {
            symbol: this.symbol,
            ensg: this.ensg,
            chr: this.chr,
            totalSgRNAs: this.getTotalSgRNACount(),
            averageEffect: this.getAverageEffect(),
            cellLines: Array.from(this.cellLines.values()).map(cl => cl.toJSON())
        };
    }

    /**
     * Create a GeneView instance from multiple database rows
     * @param {Array} rows - Array of database row objects for the same gene
     * @returns {GeneView} GeneView instance
     */
    static fromDbRows(rows) {
        if (!rows || rows.length === 0) return null;
        
        const firstRow = rows[0];
        const geneView = new GeneView({
            symbol: firstRow.symbol,
            ensg: firstRow.ensg,
            chr: firstRow.chr
        });
        
        // Add all rows as cell line data
        for (const row of rows) {
            geneView.addCellLine({
                ...row,
                id: row.rowid || row.id
            });
        }
        
        return geneView;
    }
}

/**
 * CellLineView model for cell line data within a gene
 */
class CellLineView {
    constructor(data) {
        this.name = data.name;
        this.condition = data.condition;
        this.cas = data.cas;
        this.screentype = data.screentype;
        this.pubmed = data.pubmed;
        this.sgRNAs = [];
    }

    /**
     * Add an sgRNA to this cell line
     * @param {Object} sgRNAData - sgRNA data
     */
    addSgRNA(sgRNAData) {
        this.sgRNAs.push(new SgRNAView(sgRNAData));
    }

    /**
     * Get average effect for this cell line
     * @returns {number} Average log2fc
     */
    getAverageEffect() {
        const validEffects = this.sgRNAs
            .map(sg => parseFloat(sg.log2fc))
            .filter(effect => !isNaN(effect));
        
        return validEffects.length > 0 
            ? validEffects.reduce((sum, effect) => sum + effect, 0) / validEffects.length 
            : null;
    }

    /**
     * Format the cell line view for API response
     * @returns {Object} Formatted cell line view object
     */
    toJSON() {
        return {
            name: this.name,
            condition: this.condition,
            cas: this.cas,
            screentype: this.screentype,
            pubmed: this.pubmed,
            sgRNACount: this.sgRNAs.length,
            averageEffect: this.getAverageEffect(),
            sgRNAs: this.sgRNAs.map(sg => sg.toJSON())
        };
    }
}

/**
 * SgRNAView model for individual sgRNA data
 */
class SgRNAView {
    constructor(data) {
        this.id = data.id;
        this.sequence = data.sequence;
        this.start = parseInt(data.start);
        this.end = parseInt(data.end);
        this.strand = data.strand;
        this.log2fc = data.log2fc;
        this.effect = data.effect;
        this.rc_initial = data.rc_initial;
        this.rc_final = data.rc_final;
    }

    /**
     * Calculate the midpoint of the sgRNA
     * @returns {number} Midpoint position
     */
    getMidpoint() {
        return (!isNaN(this.start) && !isNaN(this.end)) 
            ? Math.floor((this.start + this.end) / 2) 
            : null;
    }

    /**
     * Calculate the length of the sgRNA
     * @returns {number} Length in base pairs
     */
    getLength() {
        return (!isNaN(this.start) && !isNaN(this.end)) 
            ? Math.abs(this.end - this.start) + 1 
            : null;
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
     * Format the sgRNA for API response
     * @returns {Object} Formatted sgRNA object
     */
    toJSON() {
        return {
            id: this.id,
            sequence: this.sequence,
            start: this.start,
            end: this.end,
            strand: this.strand,
            log2fc: parseFloat(this.log2fc),
            effect: this.effect,
            rc_initial: this.rc_initial,
            rc_final: this.rc_final,
            midpoint: this.getMidpoint(),
            length: this.getLength(),
            foldChange: this.getFoldChange()
        };
    }
}

module.exports = { GeneView, CellLineView, SgRNAView };
