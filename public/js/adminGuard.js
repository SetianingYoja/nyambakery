import { getCurrentUser } from "./auth.js";

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    alert("Halaman ini khusus admin.");
    window.location.href = "../login.html";
    throw new Error("bukan admin");
  }
  return user;
}
