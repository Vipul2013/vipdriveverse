CREATE TABLE public.car_engine_options (
  id uuid primary key default gen_random_uuid(),
  car_id text not null,
  car_name text not null,
  brand text,
  model_year text,
  market text not null default 'India',
  variant_name text not null,
  fuel_type text not null,
  engine text,
  engine_capacity text,
  cylinders text,
  power text,
  torque text,
  transmission text,
  drivetrain text,
  mileage_or_range text,
  price text,
  fitted_type text not null default 'factory',
  notes text,
  created_at timestamptz not null default now(),
  constraint fitted_type_valid check (fitted_type in ('factory', 'aftermarket'))
);

COMMENT ON TABLE public.car_engine_options IS 'Engine/powertrain configurations per car, keyed by the stable car id from src/lib/car-id.ts. Each row is one genuine factory (or verified aftermarket) engine/fuel option for a market and model year.';

CREATE UNIQUE INDEX car_engine_options_identity_key
  ON public.car_engine_options (car_id, market, variant_name, fuel_type, coalesce(engine, ''));

CREATE INDEX car_engine_options_car_id_idx ON public.car_engine_options (car_id, market);

GRANT SELECT ON public.car_engine_options TO anon;
GRANT SELECT ON public.car_engine_options TO authenticated;
GRANT ALL ON public.car_engine_options TO service_role;

ALTER TABLE public.car_engine_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engine options are publicly readable"
  ON public.car_engine_options
  FOR SELECT
  TO anon, authenticated
  USING (true);