-- Correct Dawn Whiteflame's storefront metadata after the first Equipment browser review.
-- This intentionally changes storefront presentation only; character movement, location,
-- stock authority, and purchase behavior are untouched.

update public.characters
   set role = 'General goods merchant',
       storefront_title = 'General Goods',
       storefront_tagline = 'Quality gear for every journey.',
       updated_at = timezone('utc', now())
 where lower(name) = 'dawn whiteflame'
   and storefront_enabled is true;
