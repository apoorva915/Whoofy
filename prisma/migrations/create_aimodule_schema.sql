-- Create aimodule schema
CREATE SCHEMA IF NOT EXISTS aimodule;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA aimodule TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA aimodule TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aimodule TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA aimodule TO anon;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA aimodule GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA aimodule GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA aimodule GRANT SELECT ON TABLES TO anon;
