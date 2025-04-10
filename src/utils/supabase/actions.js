"use server";

import { redirect } from "next/navigation";

import { createClient } from "./server";

export async function signout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/error");
  }

  redirect("/login");
}

export async function uploadFileToSupabaseAndGetPublicUrl(file) {
  if (!file) {
    throw new Error("No file provided");
  }

  const supabase = await createClient();

  try {
    const fileName = `public/${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("charts-bucket")
      .upload(fileName, file);

    if (uploadError) {
      console.error("Error uploading file to Supabase:", uploadError);
      throw uploadError;
    }

    console.log("File uploaded successfully:", uploadData);

    const { data: publicUrlData, error: publicUrlError } = supabase
      .storage
      .from("charts-bucket")
      .getPublicUrl(fileName);

    if (publicUrlError) {
      console.error("Error getting public URL:", publicUrlError);
      throw publicUrlError;
    }

    console.log("Public URL retrieved successfully:", publicUrlData);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Error during Supabase file upload or URL retrieval:", error);
    throw error;
  }
}