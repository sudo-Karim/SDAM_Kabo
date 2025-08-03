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
}

module.exports = BaseModel;
