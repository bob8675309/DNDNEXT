-- Dawn Whiteflame visual calibration pack.
-- Static media ships with the app under public/merchant-media so production and preview
-- deployments resolve the same assets without coupling storefront art to an external bucket.

update public.characters
   set portrait_url = '/merchant-media/dawn-whiteflame/portrait.webp',
       portrait_thumb_url = '/merchant-media/dawn-whiteflame/thumb.webp',
       portrait_shop_url = '/merchant-media/dawn-whiteflame/portrait.webp',
       portrait_source = 'generated',
       image_url = '/merchant-media/dawn-whiteflame/portrait.webp',
       storefront_bg_url = '/merchant-media/dawn-whiteflame/storefront.webp',
       storefront_bg_image_url = '/merchant-media/dawn-whiteflame/storefront.webp',
       storefront_bg_video_url = null,
       updated_at = timezone('utc', now())
 where lower(name) = 'dawn whiteflame'
   and storefront_enabled is true;
