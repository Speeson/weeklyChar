CREATE TABLE wow_item_metadata (
  region TEXT NOT NULL,
  locale TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  name TEXT,
  icon_url TEXT,
  status TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  refresh_after INTEGER NOT NULL,
  PRIMARY KEY (region, locale, item_id)
);
