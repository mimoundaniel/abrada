-- =============================================
-- adraba v2 — with Auth & Roles
-- =============================================

CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY DEFAULT 'main',
  state JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  member_id TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('superadmin', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_state" ON app_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_state" ON app_state FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_state" ON app_state FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "read_profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "anon_profiles" ON profiles FOR SELECT TO anon USING (true);

INSERT INTO app_state (id, state) VALUES ('main', '{}') ON CONFLICT (id) DO NOTHING;

-- =============================================
-- AFTER RUNNING THIS SQL:
-- 1. Auth → Settings → Enable Email provider, disable "Confirm email" for dev
-- 2. Auth → Users → Add user (menny@yourdomain.com)
-- 3. Run: UPDATE profiles SET role='superadmin', member_id='m1', display_name='Menny'
--         WHERE email='menny@yourdomain.com';
-- 4. Repeat for each family member with role='member'
-- =============================================
