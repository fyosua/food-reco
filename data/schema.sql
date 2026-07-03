-- Schema overview — food-reco database
-- All tables managed by Alembic migrations.
-- This file is a reference; actual schema is in migrations/versions/.

-- Users
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user',
    display_name TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Food items
CREATE TABLE food_item (
    id INTEGER PRIMARY KEY,
    name_id TEXT NOT NULL,
    name_en TEXT,
    category TEXT,
    prep_type TEXT,
    calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL, fiber_g REAL,
    micros_json TEXT,
    price_pasar_min INTEGER, price_pasar_max INTEGER,
    price_market_min INTEGER, price_market_max INTEGER,
    price_warung_min INTEGER, price_warung_max INTEGER,
    tags_json TEXT,
    cuisine_tags_json TEXT,
    image_path TEXT,
    source_url TEXT,
    verification_status TEXT DEFAULT 'unverified',
    verified_at DATETIME,
    active INTEGER DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Provinces (38 official)
CREATE TABLE province (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    island_group TEXT,
    price_multiplier REAL NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Price tier overrides
CREATE TABLE price_tier_override (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    price_multiplier REAL NOT NULL,
    member_provinces TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Cities
CREATE TABLE city (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    province_code TEXT NOT NULL,
    province_name TEXT,
    is_jabodetabek INTEGER DEFAULT 0,
    price_tier TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Additional tables: meal_history, meal_feedback, user_pref, user_taste,
-- crawl_source, crawl_record, rate_limit_bucket
-- See backend/app/models/ for full definitions.