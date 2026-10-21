insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do update
set public = excluded.public;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  interest text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint inquiries_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint inquiries_phone_length check (char_length(btrim(phone)) between 5 and 40),
  constraint inquiries_email_length check (email is null or char_length(email) <= 254),
  constraint inquiries_interest_length check (char_length(btrim(interest)) between 1 and 120),
  constraint inquiries_message_length check (char_length(btrim(message)) between 5 and 3000)
);

alter table public.inquiries drop constraint if exists inquiries_interest_value;
alter table public.inquiries drop constraint if exists inquiries_interest_length;
alter table public.inquiries
  add constraint inquiries_interest_length check (char_length(btrim(interest)) between 1 and 120);

create table if not exists public.order_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  product text not null,
  quantity text not null,
  requested_date date,
  notes text,
  order_status text not null default 'pending',
  tracking_hash text unique,
  created_at timestamptz not null default now(),
  constraint order_requests_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint order_requests_phone_length check (char_length(btrim(phone)) between 5 and 40),
  constraint order_requests_email_length check (email is null or char_length(email) <= 254),
  constraint order_requests_quantity_length check (char_length(btrim(quantity)) between 1 and 120),
  constraint order_requests_notes_length check (notes is null or char_length(notes) <= 1500)
);

alter table public.order_requests drop constraint if exists order_requests_product_value;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  image_path text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint products_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint products_description_length check (char_length(btrim(description)) between 1 and 1000),
  constraint products_image_path_length check (char_length(btrim(image_path)) between 1 and 500)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint services_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint services_name_length check (char_length(btrim(name)) between 1 and 120)
);

create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  alt_text text not null,
  caption text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint gallery_image_path_length check (char_length(btrim(image_path)) between 1 and 500),
  constraint gallery_alt_text_length check (char_length(btrim(alt_text)) between 1 and 250),
  constraint gallery_caption_length check (char_length(btrim(caption)) between 1 and 120)
);

alter table public.inquiries
  add column if not exists status text not null default 'new';
alter table public.order_requests
  add column if not exists status text not null default 'new';
alter table public.order_requests
  add column if not exists order_status text not null default 'pending';
alter table public.order_requests
  add column if not exists tracking_hash text;
alter table public.inquiries drop constraint if exists inquiries_status_value;
alter table public.inquiries
  add constraint inquiries_status_value check (status in ('new', 'contacted', 'closed'));
alter table public.order_requests drop constraint if exists order_requests_status_value;
alter table public.order_requests
  add constraint order_requests_status_value check (status in ('new', 'contacted', 'closed'));
alter table public.order_requests drop constraint if exists order_requests_order_status_value;
alter table public.order_requests
  add constraint order_requests_order_status_value
  check (order_status in ('pending', 'confirmed', 'processing', 'completed', 'cancelled'));
alter table public.order_requests drop constraint if exists order_requests_tracking_hash_format;
alter table public.order_requests
  add constraint order_requests_tracking_hash_format
  check (tracking_hash is null or tracking_hash ~ '^[0-9a-f]{64}$');
create unique index if not exists order_requests_tracking_hash_idx
  on public.order_requests (tracking_hash)
  where tracking_hash is not null;

create or replace function public.lookup_order_status(p_tracking_hash text)
returns table (
  product text,
  quantity text,
  requested_date date,
  order_status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select request.product, request.quantity, request.requested_date,
    request.order_status, request.created_at
  from public.order_requests as request
  where p_tracking_hash ~ '^[0-9a-f]{64}$'
    and request.tracking_hash = p_tracking_hash
  limit 1;
$$;
revoke all on function public.lookup_order_status(text) from public, anon, authenticated;
grant execute on function public.lookup_order_status(text) to anon, authenticated;

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

do $$
declare
  admin_user_id uuid;
begin
  select id into admin_user_id
  from auth.users
  where lower(email) = lower('ukaginwilson@gmail.com');

  if admin_user_id is null then
    raise exception 'Create and confirm the Supabase account for ukaginwilson@gmail.com before applying this setup.';
  end if;

  insert into public.site_admins (user_id)
  values (admin_user_id)
  on conflict (user_id) do nothing;
end;
$$;

alter table public.site_admins enable row level security;
revoke all on table public.site_admins from anon, authenticated;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.site_admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

create index if not exists inquiries_created_at_idx
  on public.inquiries (created_at desc);
create index if not exists order_requests_created_at_idx
  on public.order_requests (created_at desc);
create table if not exists public.whatsapp_notification_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_notification_attempts_created_at_idx
  on public.whatsapp_notification_attempts (created_at);
create index if not exists whatsapp_notification_attempts_ip_created_at_idx
  on public.whatsapp_notification_attempts (ip_hash, created_at desc);
alter table public.whatsapp_notification_attempts enable row level security;

create or replace function public.claim_whatsapp_notification(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_attempts integer;
begin
  if p_ip_hash is null or char_length(p_ip_hash) <> 64 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));

  delete from public.whatsapp_notification_attempts
  where created_at < now() - interval '1 day';

  select count(*)::integer
  into recent_attempts
  from public.whatsapp_notification_attempts
  where ip_hash = p_ip_hash
    and created_at >= now() - interval '15 minutes';

  if recent_attempts >= 3 then
    return false;
  end if;

  insert into public.whatsapp_notification_attempts (ip_hash)
  values (p_ip_hash);

  return true;
end;
$$;

revoke all on table public.whatsapp_notification_attempts from anon, authenticated;
grant all on table public.whatsapp_notification_attempts to service_role;
revoke all on function public.claim_whatsapp_notification(text) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_notification(text) to service_role;

create index if not exists products_display_order_idx
  on public.products (sort_order, name);
create index if not exists services_display_order_idx
  on public.services (sort_order, name);
create index if not exists gallery_images_display_order_idx
  on public.gallery_images (sort_order, created_at);

insert into public.products (slug, name, description, image_path, sort_order)
values
  (
    'broiler-breeders',
    'Broiler breeders',
    'Broiler breeder birds for farmers building or expanding a breeding flock. Ask us about current availability.',
    '2733-COBB-Avian-48-broiler-breeder-696x456.jpg',
    1
  ),
  (
    'day-old-broilers',
    'Day-old broilers',
    'Day-old broiler chicks for farmers starting or expanding a meat-bird flock.',
    '19b2674528b4d5fa396dcc8c20062871_XL.jpg',
    2
  ),
  (
    'day-old-kuroilers',
    'Day-old Kuroilers',
    'Day-old Kuroiler chicks for farmers looking to raise a versatile flock. Contact us for details.',
    'kuroiler1.jfif',
    3
  )
on conflict (slug) do nothing;

insert into public.services (slug, name, sort_order)
values
  ('broiler-breeder-stock', 'Broiler breeder stock', 1),
  ('day-old-broiler-chicks', 'Day-old broiler chicks', 2),
  ('day-old-kuroiler-chicks', 'Day-old Kuroiler chicks', 3),
  ('hatchery-services', 'Hatchery services', 4),
  ('poultry-feeds-and-farmer-support', 'Poultry feeds and farmer support', 5)
on conflict (slug) do nothing;

insert into public.gallery_images (image_path, alt_text, caption, sort_order)
select seed.image_path, seed.alt_text, seed.caption, seed.sort_order
from (values
  (
    '2733-COBB-Avian-48-broiler-breeder-696x456.jpg',
    'Broiler breeder birds',
    'Broiler breeders',
    1
  ),
  (
    '19b2674528b4d5fa396dcc8c20062871_XL.jpg',
    'Day-old chicks in a brooder',
    'Day-old broiler chicks',
    2
  ),
  (
    'Alt-con-7.png',
    'Broiler flock',
    'Broiler flock',
    3
  )
) as seed(image_path, alt_text, caption, sort_order)
where not exists (
  select 1
  from public.gallery_images existing
  where existing.image_path = seed.image_path
    and existing.caption = seed.caption
);

alter table public.inquiries enable row level security;
alter table public.order_requests enable row level security;
alter table public.products enable row level security;
alter table public.services enable row level security;
alter table public.gallery_images enable row level security;

revoke all on table public.inquiries, public.products, public.services, public.gallery_images
  from anon, authenticated;
revoke all on table public.order_requests from anon, authenticated;

grant insert (name, phone, email, interest, message) on table public.inquiries to anon, authenticated;
grant select on table public.inquiries to authenticated;
grant update (status) on table public.inquiries to authenticated;
grant insert (name, phone, email, product, quantity, requested_date, notes, tracking_hash)
  on table public.order_requests to anon, authenticated;
grant select on table public.order_requests to authenticated;
grant update (name, phone, email, product, quantity, requested_date, notes, order_status)
  on table public.order_requests to authenticated;
grant select on table public.products, public.services, public.gallery_images to anon, authenticated;
grant insert, update, delete on table public.products, public.services, public.gallery_images to authenticated;

drop policy if exists "Site admins can manage catalog content" on public.products;
create policy "Site admins can manage catalog content"
  on public.products
  for all
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

drop policy if exists "Site admins can manage services" on public.services;
create policy "Site admins can manage services"
  on public.services
  for all
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

drop policy if exists "Site admins can manage gallery" on public.gallery_images;
create policy "Site admins can manage gallery"
  on public.gallery_images
  for all
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

drop policy if exists "Site admins can view inquiries" on public.inquiries;
create policy "Site admins can view inquiries"
  on public.inquiries
  for select
  to authenticated
  using (public.is_site_admin());

drop policy if exists "Site admins can update inquiries" on public.inquiries;
create policy "Site admins can update inquiries"
  on public.inquiries
  for update
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

drop policy if exists "Site admins can view order requests" on public.order_requests;
create policy "Site admins can view order requests"
  on public.order_requests
  for select
  to authenticated
  using (public.is_site_admin());

drop policy if exists "Site admins can update order requests" on public.order_requests;
create policy "Site admins can update order requests"
  on public.order_requests
  for update
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

drop policy if exists "Site admins can upload site images" on storage.objects;
create policy "Site admins can upload site images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'site-images' and public.is_site_admin());

drop policy if exists "Site admins can update site images" on storage.objects;
create policy "Site admins can update site images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'site-images' and public.is_site_admin())
  with check (bucket_id = 'site-images' and public.is_site_admin());

drop policy if exists "Site admins can delete site images" on storage.objects;
create policy "Site admins can delete site images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'site-images' and public.is_site_admin());

drop policy if exists "Anyone can submit an inquiry" on public.inquiries;
create policy "Anyone can submit an inquiry"
  on public.inquiries
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(name)) between 2 and 120
    and char_length(btrim(phone)) between 5 and 40
    and (email is null or char_length(email) <= 254)
    and char_length(btrim(interest)) between 1 and 120
    and (
      interest = 'Other'
      or exists (
        select 1 from public.products
        where name = interest and is_active
      )
      or exists (
        select 1 from public.services
        where name = interest and is_active
      )
    )
    and char_length(btrim(message)) between 5 and 3000
  );

drop policy if exists "Anyone can submit an order request" on public.order_requests;
create policy "Anyone can submit an order request"
  on public.order_requests
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(name)) between 2 and 120
    and char_length(btrim(phone)) between 5 and 40
    and (email is null or char_length(email) <= 254)
    and (
      exists (
        select 1 from public.products
        where name = product and is_active
      )
      or exists (
        select 1 from public.services
        where name = product and is_active
      )
    )
    and char_length(btrim(quantity)) between 1 and 120
    and (requested_date is null or requested_date >= current_date)
    and (notes is null or char_length(notes) <= 1500)
    and (tracking_hash is null or tracking_hash ~ '^[0-9a-f]{64}$')
  );

insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Public can view active services" on public.services;
create policy "Public can view active services"
  on public.services
  for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Public can view active gallery images" on public.gallery_images;
create policy "Public can view active gallery images"
  on public.gallery_images
  for select
  to anon, authenticated
  using (is_active);
