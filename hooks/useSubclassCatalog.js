import { useEffect, useState } from "react";
import { resolveSubclassCatalog } from "../utils/classes/subclassCompatibility";
import { supabase } from "../utils/supabaseClient";

export default function useSubclassCatalog(classKey = "", classSource = "XPHB", enabled = true) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!enabled || !classKey) {
        setOptions([]);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      const result = await supabase
        .from("class_feature_catalog")
        .select("id,feature_key,feature_type,name,source,class_key,class_name,class_source,subclass_name,subclass_short_name,level,description,raw_payload")
        .eq("class_key", classKey)
        .eq("feature_type", "subclass")
        .order("level", { ascending: true })
        .order("name", { ascending: true })
        .limit(5000);

      if (!active) return;
      if (result.error) {
        setOptions([]);
        setError(result.error.message || "Could not load subclasses.");
      } else {
        setOptions(resolveSubclassCatalog(result.data || [], classSource));
      }
      setLoading(false);
    }

    load();
    return () => { active = false; };
  }, [classKey, classSource, enabled]);

  return { options, loading, error };
}
