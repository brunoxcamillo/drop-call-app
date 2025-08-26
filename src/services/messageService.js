import { supabase } from "../utils/supabaseClient.js";



export async function getMessageByType(type, countryCode) {
  const { data, error } = await supabase
    .from("country_messages")
    .select("*")
    .eq("type", type)
    .eq("country_code", countryCode);

  if (error) throw error;
  return data;
}