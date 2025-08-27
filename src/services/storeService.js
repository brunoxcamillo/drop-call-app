import { supabase } from "../utils/supabaseClient.js";


export async function getStoreByDomain(domain) {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("domain", domain)
    .single();

  if (error) throw error;
  return data;
}


export async function getStoreById(id) {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}