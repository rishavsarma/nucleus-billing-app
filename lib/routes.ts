// Single source of truth for every in-app route (locale-stripped — pass
// these to next-intl's Link/useRouter from "@/i18n/navigation", which adds
// the locale prefix). Mirrors the folder structure under app/[locale]/(app)
// and (auth). Keep this in sync whenever a route is added, renamed, or moved.

export const routes = {
  home: "/",

  dashboard: {
    overview: "/dashboard/overview",
    reports: "/dashboard/reports",
    analysis: "/dashboard/analysis",
  },

  sales: {
    billing: "/sales/billing",
    invoices: {
      list: "/sales/invoices",
      new: "/sales/invoices/new",
      detail: (id: string) => `/sales/invoices/${id}`,
    },
    creditNotes: {
      list: "/sales/credit-notes",
      new: "/sales/credit-notes/new",
      detail: (id: string) => `/sales/credit-notes/${id}`,
    },
    payments: "/sales/payments",
  },

  purchases: {
    bills: {
      list: "/purchases/bills",
      new: "/purchases/bills/new",
      detail: (id: string) => `/purchases/bills/${id}`,
    },
    debitNotes: {
      list: "/purchases/debit-notes",
      new: "/purchases/debit-notes/new",
      detail: (id: string) => `/purchases/debit-notes/${id}`,
    },
    payments: "/purchases/payments",
  },

  catalog: {
    items: {
      list: "/catalog/items",
      new: "/catalog/items/new",
      detail: (id: string) => `/catalog/items/${id}`,
    },
    taxRates: "/catalog/tax-rates",
    warehouses: "/catalog/warehouses",
    deliveryPersons: "/catalog/delivery-persons",
    offers: {
      list: "/catalog/offers",
      new: "/catalog/offers/new",
      detail: (id: string) => `/catalog/offers/${id}`,
    },
  },

  parties: {
    customers: {
      list: "/parties/customers",
      new: "/parties/customers/new",
      detail: (id: string) => `/parties/customers/${id}`,
    },
    vendors: {
      list: "/parties/vendors",
      new: "/parties/vendors/new",
      detail: (id: string) => `/parties/vendors/${id}`,
    },
  },

  inventory: {
    stock: "/inventory/stock",
    movements: {
      list: "/inventory/movements",
      new: "/inventory/movements/new",
    },
  },

  settings: {
    organization: "/settings/organization",
    members: "/settings/members",
    subscription: "/settings/subscription",
    addons: "/settings/addons",
    appSettings: "/settings/app-settings",
  },

  admin: {
    organizations: {
      list: "/admin/organizations",
      new: "/admin/organizations/new",
      detail: (id: string) => `/admin/organizations/${id}`,
    },
    superadmins: "/admin/superadmins",
  },

  auth: {
    login: "/login",
  },
} as const
