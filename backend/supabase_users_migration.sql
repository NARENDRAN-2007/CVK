-- ==============================================================================
-- DenialGuard AI - Supabase Users Table Migration
-- Run this in your Supabase SQL Editor to enable database-backed User Authentication.
-- ==============================================================================

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Biller', 'Analyst', 'Admin', 'Read-only')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_users_work_email ON users(LOWER(work_email));

-- 3. Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. Service role full access policy
CREATE POLICY "Service role full access on users" ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Seed default test accounts (Default password: password123)
-- Verified bcrypt hash for password123: $2b$12$Fke5UpZupsggVv2va.A7p.q0UUbDElD.450bg4PfSRWpfUuJV34qa
INSERT INTO users (work_email, password_hash, name, role)
VALUES 
    ('admin@denialguard.com', '$2b$12$Fke5UpZupsggVv2va.A7p.q0UUbDElD.450bg4PfSRWpfUuJV34qa', 'Alice Admin', 'Admin'),
    ('malvarez@northstar.health', '$2b$12$Fke5UpZupsggVv2va.A7p.q0UUbDElD.450bg4PfSRWpfUuJV34qa', 'Maya Alvarez', 'Analyst'),
    ('jlee@northstar.health', '$2b$12$Fke5UpZupsggVv2va.A7p.q0UUbDElD.450bg4PfSRWpfUuJV34qa', 'Jordan Lee', 'Biller'),
    ('biller@denialguard.com', '$2b$12$Fke5UpZupsggVv2va.A7p.q0UUbDElD.450bg4PfSRWpfUuJV34qa', 'Bob Biller', 'Biller')
ON CONFLICT (work_email) DO NOTHING;
