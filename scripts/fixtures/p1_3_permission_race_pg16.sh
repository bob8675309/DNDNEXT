#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" && "$PGHOST" != "localhost" ]] ||
   [[ "$PGDATABASE" != "p13_live_source_sandbox" ]] || [[ "$PGUSER" != "postgres" ]]; then
 echo "REFUSED: disposable local PG16 only" >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
check(){ psqlq -c "DO \$check\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'Permission fixture failed: $2'; END IF; END \$check\$;"; }
stale_action(){
 psqlq -c "BEGIN;SET LOCAL dndnext.fixture_user_id='00000000-0000-0000-0000-000000000901';
 DO \$a\$ BEGIN IF NOT public.encounter_can_control_participant_v1(public.fixture_uuid(5801)) THEN RAISE EXCEPTION 'Expected permission grant'; END IF; END \$a\$;
 SELECT pg_sleep(0.72);
 UPDATE public.encounter_participants SET action_available=false WHERE id=public.fixture_uuid(5801);
 INSERT INTO public.p13_auth_race_events VALUES ('stale_action',clock_timestamp());COMMIT;" >"$tmp/stale.action" 2>&1
}
revoke(){
 local label="$1" out="$2"
 psqlq -c "BEGIN;UPDATE public.character_permissions SET can_edit=false
 WHERE character_id=public.fixture_uuid(11) AND user_id=public.fixture_uuid(901);
 INSERT INTO public.p13_auth_race_events VALUES ('$label',clock_timestamp());COMMIT;" >"$out" 2>&1
}
echo 'PERMISSION CASE 15: unprotected actual control check can become stale before simulated action'
stale_action & a=$!
sleep 0.24
revoke stale_revoke "$tmp/stale.revoke" & b=$!
wait "$a";wait "$b"
check "(SELECT occurred_at FROM public.p13_auth_race_events WHERE label='stale_revoke') <
 (SELECT occurred_at FROM public.p13_auth_race_events WHERE label='stale_action')
 AND (SELECT can_edit=false FROM public.character_permissions WHERE character_id=public.fixture_uuid(11) AND user_id=public.fixture_uuid(901))
 AND (SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5801))" "unlocked validation was stale"
echo "PASS: original control helper returned true, synthetic action committed after grant revocation"
echo 'PERMISSION CASE 16: explicit FOR SHARE of permission serializes action ahead of revocation'
psqlq -c "UPDATE public.character_permissions SET can_edit=true WHERE character_id=public.fixture_uuid(11);
 UPDATE public.encounter_participants SET action_available=true WHERE id=public.fixture_uuid(5801);"
safe_action(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';SET LOCAL dndnext.fixture_user_id='00000000-0000-0000-0000-000000000901';
 SELECT 1 FROM public.character_permissions
 WHERE character_id=public.fixture_uuid(11) AND user_id=public.fixture_uuid(901) FOR SHARE;
 DO \$a\$ BEGIN IF NOT public.encounter_can_control_participant_v1(public.fixture_uuid(5801)) THEN RAISE EXCEPTION 'Expected permission grant'; END IF; END \$a\$;
 SELECT pg_sleep(0.72);
 UPDATE public.encounter_participants SET action_available=false WHERE id=public.fixture_uuid(5801);
 INSERT INTO public.p13_auth_race_events VALUES ('guarded_action',clock_timestamp());COMMIT;" >"$tmp/guarded.action" 2>&1
}
safe_action & a=$!
sleep 0.24
revoke guarded_revoke "$tmp/guarded.revoke" & b=$!
wait "$a";wait "$b"
check "(SELECT occurred_at FROM public.p13_auth_race_events WHERE label='guarded_action') <
 (SELECT occurred_at FROM public.p13_auth_race_events WHERE label='guarded_revoke')
 AND (SELECT can_edit=false FROM public.character_permissions WHERE character_id=public.fixture_uuid(11))
 AND (SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5801))" "permission-row lock serializes"
echo "PASS: explicit permission row lock forced simulated action before revoked grant"
echo "PASS: two permission race cases, original control helper and synthetic action, NO real JWT or DnDNext command."
