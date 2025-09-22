-- UK Government Technology Standards Database Schema

CREATE TABLE IF NOT EXISTS standards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    summary TEXT,
    last_updated DATE,
    source_org TEXT,
    tags TEXT, -- JSON array as string
    compliance_level TEXT CHECK(compliance_level IN ('mandatory', 'recommended', 'optional')),
    related_standards TEXT, -- JSON array as string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY,
    description TEXT,
    standards_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scraping_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'skipped')),
    error_message TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    content_hash TEXT,
    page_size INTEGER
);

CREATE TABLE IF NOT EXISTS update_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    standard_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (standard_id) REFERENCES standards(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_standards_category ON standards(category);
CREATE INDEX IF NOT EXISTS idx_standards_source_org ON standards(source_org);
CREATE INDEX IF NOT EXISTS idx_standards_last_updated ON standards(last_updated);
CREATE INDEX IF NOT EXISTS idx_standards_tags ON standards(tags);
CREATE INDEX IF NOT EXISTS idx_scraping_log_url ON scraping_log(url);
CREATE INDEX IF NOT EXISTS idx_scraping_log_scraped_at ON scraping_log(scraped_at);

-- Full-text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS standards_fts USING fts5(
    id,
    title,
    content,
    summary,
    tags,
    content=standards,
    content_rowid=rowid
);

-- Triggers to keep FTS table in sync
CREATE TRIGGER IF NOT EXISTS standards_fts_insert AFTER INSERT ON standards
BEGIN
    INSERT INTO standards_fts(id, title, content, summary, tags)
    VALUES (new.id, new.title, new.content, new.summary, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS standards_fts_delete AFTER DELETE ON standards
BEGIN
    DELETE FROM standards_fts WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS standards_fts_update AFTER UPDATE ON standards
BEGIN
    UPDATE standards_fts 
    SET title = new.title,
        content = new.content,
        summary = new.summary,
        tags = new.tags
    WHERE id = new.id;
END;

-- Trigger to update timestamps
CREATE TRIGGER IF NOT EXISTS standards_update_timestamp 
    AFTER UPDATE ON standards
    FOR EACH ROW
BEGIN
    UPDATE standards SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;