-- Original live source-discriminator helpers (not stubs), used by the
-- Cartomancer and runtime-expertise downstream grant-instance triggers.
-- Only original registration/negative Lucky test; no specialty family coverage.
-- live MD5 3801761f8bc46c5af10fca5e5ae73e60
CREATE OR REPLACE FUNCTION private.cartomancer_family_v1(p_option_name text, p_option_source text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select lower(regexp_replace(coalesce(p_option_name,''),'[^a-zA-Z0-9]+','','g'))='cartomancer'
     and upper(coalesce(p_option_source,''))='BMT';
$function$;

-- live MD5 be000f9e6d6e129cb9505b110a1021ed
CREATE OR REPLACE FUNCTION private.feat_runtime_expertise_family_v1(p_option_name text, p_option_source text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when lower(regexp_replace(coalesce(p_option_name,''),'[^a-zA-Z0-9]+','','g'))='echoingsoul' and upper(coalesce(p_option_source,''))='RHW' then 'echoing-soul'
    when lower(regexp_replace(coalesce(p_option_name,''),'[^a-zA-Z0-9]+','','g'))='zhentarimtactics' and upper(coalesce(p_option_source,''))='FRHOF' then 'zhentarim-tactics'
    else null
  end;
$function$;
