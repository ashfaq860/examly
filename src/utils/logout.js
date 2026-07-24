// utils/logout.js
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function useLogout() {
  const logout = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
        localStorage.removeItem('user');
        Cookies.remove('role');
        if (error) throw error;
       toast.success("Logged out successfully!");
      window.location.href = '/auth/login';
    } catch (err) {
      console.error("Logout error:", err.message);
      toast.error("Error logging out. Please try again.");
    }
  };

  return logout;
}
