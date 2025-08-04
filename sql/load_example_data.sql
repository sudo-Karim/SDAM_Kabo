-- Load example data
-- This creates a small dataset for development and testing
-- Usage: sqlite3 genome_crispr.db < sql/load_example_data.sql

-- Drop existing tables and recreate with normalized structure
DROP VIEW IF EXISTS genome_crispr;
DROP VIEW IF EXISTS genome_crispr_relational;
DROP VIEW IF EXISTS genome_crispr_view;
DROP TABLE IF EXISTS genome_crispr;
DROP TABLE IF EXISTS genes;
DROP TABLE IF EXISTS cell_lines;
DROP TABLE IF EXISTS experiments;
DROP TABLE IF EXISTS sgrnas;

-- Create normalized table structure
CREATE TABLE genes (
    gene_id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    ensg TEXT,
    chr TEXT NOT NULL
);

CREATE TABLE cell_lines (
    cellline_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE experiments (
    experiment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    gene_id INTEGER NOT NULL,
    cellline_id INTEGER NOT NULL,
    condition TEXT,
    cas TEXT,
    screentype TEXT,
    pubmed TEXT,
    FOREIGN KEY (gene_id) REFERENCES genes(gene_id),
    FOREIGN KEY (cellline_id) REFERENCES cell_lines(cellline_id)
);

CREATE TABLE sgrnas (
    sgrna_id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    sequence TEXT NOT NULL,
    start_pos INTEGER NOT NULL,
    end_pos INTEGER NOT NULL,
    strand TEXT,
    log2fc REAL,
    effect TEXT,
    rc_initial INTEGER,
    rc_final INTEGER,
    FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id)
);

-- Insert example data
INSERT INTO genes (symbol, ensg, chr) VALUES
('TP53', 'ENSG00000141510', '17'),
('BRCA1', 'ENSG00000012048', '17'),
('EGFR', 'ENSG00000146648', '7'),
('MYC', 'ENSG00000136997', '8'),
('KRAS', 'ENSG00000133703', '12');

INSERT INTO cell_lines (name) VALUES
('HeLa'),
('Jiyoye'),
('KBM7');

-- Insert experiments
INSERT INTO experiments (gene_id, cellline_id, condition, cas, screentype, pubmed) VALUES
(1, 1, 'control', 'Cas9', 'survival', '12345'),
(1, 2, 'control', 'Cas9', 'survival', '12345'),
(2, 1, 'control', 'Cas9', 'survival', '12346'),
(3, 3, 'treatment', 'Cas9', 'proliferation', '12347'),
(4, 1, 'control', 'Cas9', 'survival', '12348'),
(5, 2, 'control', 'Cas9', 'survival', '12349');

-- Insert sample sgRNAs  
INSERT INTO sgrnas (experiment_id, sequence, start_pos, end_pos, strand, log2fc, effect, rc_initial, rc_final) VALUES
(1, 'GACTCCAGTGGTAATCTACT', 7572026, 7572048, '+', -2.5, 'down', 1000, 250),
(1, 'CACTCCAGTGGTAATCTACT', 7572036, 7572058, '+', -1.8, 'down', 950, 400),
(1, 'TACTCCAGTGGTAATCTACT', 7572046, 7572068, '-', -3.2, 'down', 1100, 150),
(2, 'GACTCCAGTGGTAATCTACT', 7572026, 7572048, '+', -2.1, 'down', 800, 300),
(2, 'CACTCCAGTGGTAATCTACT', 7572036, 7572058, '+', -1.5, 'down', 750, 450),
(3, 'GAATTCAGTGGTAATCTACT', 41196362, 41196384, '+', 1.2, 'up', 500, 850),
(3, 'CAATTCAGTGGTAATCTACT', 41196372, 41196394, '+', 0.8, 'up', 600, 900),
(4, 'GCCTCCAGTGGTAATCTACT', 55241707, 55241729, '-', 2.8, 'up', 400, 1200),
(4, 'ACCTCCAGTGGTAATCTACT', 55241717, 55241739, '-', 3.1, 'up', 350, 1300),
(5, 'GTCTCCAGTGGTAATCTACT', 128748315, 128748337, '+', -0.5, 'down', 900, 700),
(6, 'ATCTCCAGTGGTAATCTACT', 25398284, 25398306, '+', 1.7, 'up', 600, 1100);

-- Create optimized indexes
CREATE INDEX idx_genes_symbol ON genes(symbol);
CREATE INDEX idx_genes_chr ON genes(chr);
CREATE INDEX idx_experiments_gene ON experiments(gene_id);
CREATE INDEX idx_experiments_cellline ON experiments(cellline_id);
CREATE INDEX idx_sgrnas_experiment ON sgrnas(experiment_id);
CREATE INDEX idx_sgrnas_log2fc ON sgrnas(log2fc);
CREATE INDEX idx_sgrnas_position ON sgrnas(start_pos, end_pos);
CREATE INDEX idx_genes_symbol_chr ON genes(symbol, chr);
CREATE INDEX idx_experiments_gene_cellline ON experiments(gene_id, cellline_id);

-- Create compatibility view for existing queries
CREATE VIEW genome_crispr AS
SELECT 
    s.sgrna_id as rowid,
    s.start_pos as start,
    s.end_pos as end,
    g.chr,
    s.strand,
    e.pubmed,
    cl.name as cellline,
    e.condition,
    s.sequence,
    g.symbol,
    g.ensg,
    s.log2fc,
    s.rc_initial,
    s.rc_final,
    s.effect,
    e.cas,
    e.screentype
FROM sgrnas s
JOIN experiments e ON s.experiment_id = e.experiment_id
JOIN genes g ON e.gene_id = g.gene_id
JOIN cell_lines cl ON e.cellline_id = cl.cellline_id;

-- Verify example data
SELECT 'Example data loaded:' as info, COUNT(*) as records FROM genome_crispr;
SELECT 'Database switched to EXAMPLE data - Ready for development/testing' as status;
