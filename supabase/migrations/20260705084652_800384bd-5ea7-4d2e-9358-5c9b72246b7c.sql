
CREATE TABLE public.dream_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  username_lower text NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dream_users TO service_role;
ALTER TABLE public.dream_users ENABLE ROW LEVEL SECURITY;
-- No policies: only accessed via service_role from server functions.

CREATE TABLE public.dream_garage_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.dream_users(id) ON DELETE CASCADE,
  car_query text NOT NULL,
  car_name text NOT NULL,
  brand text,
  model_year text,
  body_type text,
  fuel_type text,
  image_url text,
  summary text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, car_query)
);
CREATE INDEX dream_garage_cars_user_idx ON public.dream_garage_cars(user_id, added_at DESC);
GRANT ALL ON public.dream_garage_cars TO service_role;
ALTER TABLE public.dream_garage_cars ENABLE ROW LEVEL SECURITY;
