/**
 * Base model class with common functionality
 */

class BaseModel {
    constructor(data = {}) {
        // Set properties from data object
        Object.assign(this, data);
    }

    /**
     * Generic toJSON method that can be overridden
     * @returns {Object} JSON representation
     */
    toJSON() {
        return { ...this };
    }

    /**
     * Generic fromDbRow static method
     * @param {Object} row - Database row
     * @returns {BaseModel} Model instance
     */
    static fromDbRow(row) {
        return new this(row);
    }

    /**
     * Check if a numeric value is valid
     * @param {any} value - Value to check
     * @returns {boolean} True if valid number
     */
    isValidNumber(value) {
        return value !== null && value !== undefined && !isNaN(parseFloat(value));
    }

    /**
     * Parse a numeric value safely
     * @param {any} value - Value to parse
     * @returns {number|null} Parsed number or null
     */
    parseNumber(value) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Parse an integer value safely
     * @param {any} value - Value to parse
     * @returns {number|null} Parsed integer or null
     */
    parseInt(value) {
        const parsed = parseInt(value);
        return isNaN(parsed) ? null : parsed;
    }
}

module.exports = BaseModel;
