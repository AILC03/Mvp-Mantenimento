export type AuthUser = {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "LEAD_MECHANIC" | "WAREHOUSE_CLERK" | "DRIVER" | "TECHNICIAN";
};
