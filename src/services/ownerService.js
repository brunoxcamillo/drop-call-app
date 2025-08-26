import { supabase } from "../utils/supabaseClient.js";

export async function createOwner(ownerData) {
  const { name, email, phone } = ownerData;

  const { data, error } = await supabase
    .from("owners")
    .insert([{ name, email, phone }])
    .select()
    .single(); // retorna o registro criado

  if (error) throw error;
  return data;
}

export async function getOwners() {
  const { data, error } = await supabase
    .from("owners")
    .select();

  if (error) throw error;
  return data;
}