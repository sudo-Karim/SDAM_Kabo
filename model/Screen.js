/**
 * Screen model for CRISPR screen data
 */

class Screen {
    constructor(data) {
        this.id = data.id;
        this.pubmed = data.pubmed;
        this.cellline = data.cellline;
        this.condition = data.condition;
        this.cas = data.cas;
        this.screentype = data.screentype;
    }

    /**
     * Format the screen for API response
     * @returns {Object} Formatted screen object
     */
    toJSON() {
        return {
            id: this.id,
            pubmed: this.pubmed,
            cellline: this.cellline,
            condition: this.condition,
            cas: this.cas,
            screentype: this.screentype
        };
    }

    /**
     * Create a Screen instance from database row
     * @param {Object} row - Database row object
     * @returns {Screen} Screen instance
     */
    static fromDbRow(row) {
        return new Screen(row);
    }
}

module.exports = Screen;
