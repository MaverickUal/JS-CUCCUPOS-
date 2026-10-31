


export function roleLabel(role) {
  switch (role) {
    case "admin":
      return "Owner/Manager"
    case "cashier":
      return "Cashier"
    default:
      return "Unknown"
  }
}


export function isCashier(role) {
  return role === "cashier"
}


export function isAdmin(role) {
  return role === "admin"
}