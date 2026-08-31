CREATE TABLE wells (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    start_depth DOUBLE PRECISION NOT NULL, 
    stop_depth DOUBLE PRECISION NOT NULL,
    step DOUBLE PRECISION NOT NULL,
    null_value DOUBLE PRECISION NOT NULL,
    source_file TEXT NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);

CREATE TABLE curves (
    well_id INTEGER NOT NULL REFERENCES wells(id),
    mnemonic TEXT NOT NULL,
    unit TEXT NOT NULL,
    depths DOUBLE PRECISION[] NOT NULL,
    readings DOUBLE PRECISION[] NOT NULL,
    PRIMARY KEY (well_id, mnemonic)
);

CREATE TABLE quality_flags (
    id SERIAL PRIMARY KEY,
    well_id INTEGER NOT NULL REFERENCES wells(id),
    flag_type TEXT NOT NULL CHECK (flag_type IN ('duplicate_depth', 'curve_gap', 'flatline', 'out_of_range')),
    curve TEXT,
    depth_start DOUBLE PRECISION,
    depth_end DOUBLE PRECISION,
    detail TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);