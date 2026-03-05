import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const es = {
  nav: {
    dashboard: "Dashboard", properties: "Propiedades", clients: "Clientes",
    bookings: "Reservas", financials: "Financiero", contracts: "Contratos",
    templates: "Templates", police: "Partes SES", settings: "Configuración"
  },
  common: {
    save: "Guardar cambios", saving: "Guardando...", saved: "✅ Guardado",
    cancel: "Cancelar", delete: "Eliminar", edit: "Editar", create: "Crear",
    search: "Buscar", loading: "Cargando...", noData: "Sin datos registrados",
    back: "← Volver", actions: "Acciones", new: "Nuevo", view: "Ver",
    send: "Enviar", close: "Cerrar", name: "Nombre", email: "Email",
    phone: "Teléfono", address: "Dirección", city: "Ciudad", date: "Fecha",
    total: "Total", status: "Estado", notes: "Notas", type: "Tipo"
  },
  dashboard: {
    title: "Dashboard", totalRevenue: "Ingresos totales", activeBookings: "Reservas activas",
    totalProperties: "Propiedades", totalClients: "Clientes",
    recentBookings: "Reservas recientes", occupancyRate: "Tasa de ocupación"
  },
  properties: { title: "Propiedades", new: "Nueva propiedad", rooms: "Habitaciones", province: "Provincia", registered: "propiedades registradas" },
  clients: {
    title: "Clientes", new: "Nuevo cliente", dni: "DNI/Pasaporte", nationality: "Nacionalidad",
    birthDate: "Fecha nacimiento", firstName: "Nombre", lastName: "Apellidos",
    bookings: "Reservas", rating: "Valoración", noRating: "Sin valorar", registered: "clientes registrados"
  },
  bookings: {
    title: "Reservas", new: "Nueva reserva", checkIn: "Check-in", checkOut: "Check-out",
    nights: "noches", source: "Origen", property: "Propiedad", client: "Cliente",
    guests: "Huéspedes", deposit: "Fianza", registered: "reservas registradas",
    sources: { direct: "Directo", airbnb: "Airbnb", booking: "Booking", vrbo: "Vrbo", manual_block: "Bloqueo" },
    statuses: { confirmed: "Confirmada", cancelled: "Cancelada", completed: "Completada" },
    rating: "Valoración de la estancia", noRating: "Sin valoración todavía",
    rateStay: "★ Valorar", contract: "Contrato", noContract: "No hay contrato asociado",
    financials: "Registros financieros", noFinancials: "No hay registros financieros para esta reserva",
    cancel: "Cancelar reserva", additionalGuests: "Huéspedes adicionales"
  },
  financials: {
    title: "Financiero", new: "Nuevo registro", income: "Ingreso", expense: "Gasto",
    category: "Categoría", description: "Descripción", amount: "Importe", registered: "registros financieros"
  },
  contracts: {
    title: "Contratos", new: "Nuevo contrato", template: "Template", signed: "Firmado",
    pending: "Pendiente de firma", signLink: "Link de firma", viewContract: "📄 Ver",
    registered: "contratos registrados",
    statuses: { draft: "Borrador", sent: "Enviado", signed: "Firmado", cancelled: "Cancelado" }
  },
  settings: {
    title: "Configuración", subtitle: "Datos de la organización",
    tabs: { user: "👤 Usuario", general: "🏢 General", fiscal: "📋 Fiscal", email: "📧 Email SMTP", preferences: "⚙️ Preferencias" },
    logo: "Logo de la empresa", uploadLogo: "Subir logo", deleteLogo: "Eliminar",
    companyName: "Nombre de la empresa", contactEmail: "Email de contacto", nif: "NIF / CIF",
    smtp: { title: "Configuración SMTP", host: "Servidor SMTP", port: "Puerto", user: "Usuario", pass: "Contraseña", from: "Email remitente", saved: "✓ guardada" },
    currency: "Moneda", dateFormat: "Formato de fecha", theme: "Tema de visualización",
    themeDark: "Oscuro", themeLight: "Claro", language: "Idioma del sistema",
    languageNote: "Estas preferencias se guardan en tu navegador y solo afectan a tu sesión.",
    fiscalNote: "El NIF y la dirección fiscal se usan en los contratos y documentos generados."
  },
  templates: {
    title: 'Templates de contrato',
    new: 'Nuevo template',
    owner: 'Propietario',
    ownerNif: 'NIF propietario',
    ownerAddress: 'Dirección propietario',
    ownerSignature: 'Firma del arrendador',
    clauses: 'Cláusulas adicionales',
    content: 'Contenido del contrato',
    preview: '👁 Vista previa',
    edit: '✏️ Editar',
    variables: 'Variables disponibles',
  },
  evaluations: {
    rate: "★ Valorar estancia", edit: "Editar", title: "Valorar estancia", editTitle: "Editar valoración",
    score: "Puntuación", comment: "Comentario", commentPlaceholder: "Ej: Cliente muy cuidadoso, dejó la casa perfecta",
    scores: ["", "Muy malo", "Malo", "Normal", "Bueno", "Excelente"],
    save: "Guardar valoración", noRating: "Sin valoraciones", avgRating: "Valoración media",
    totalBookings: "Reservas totales", totalSpent: "Total gastado"
  }
};

const en = {
  nav: {
    dashboard: "Dashboard", properties: "Properties", clients: "Clients",
    bookings: "Bookings", financials: "Financials", contracts: "Contracts",
    templates: "Templates", police: "Guest Reports", settings: "Settings"
  },
  common: {
    save: "Save changes", saving: "Saving...", saved: "✅ Saved",
    cancel: "Cancel", delete: "Delete", edit: "Edit", create: "Create",
    search: "Search", loading: "Loading...", noData: "No data registered",
    back: "← Back", actions: "Actions", new: "New", view: "View",
    send: "Send", close: "Close", name: "Name", email: "Email",
    phone: "Phone", address: "Address", city: "City", date: "Date",
    total: "Total", status: "Status", notes: "Notes", type: "Type"
  },
  dashboard: {
    title: "Dashboard", totalRevenue: "Total revenue", activeBookings: "Active bookings",
    totalProperties: "Properties", totalClients: "Clients",
    recentBookings: "Recent bookings", occupancyRate: "Occupancy rate"
  },
  properties: { title: "Properties", new: "New property", rooms: "Rooms", province: "Province", registered: "properties registered" },
  clients: {
    title: "Clients", new: "New client", dni: "ID/Passport", nationality: "Nationality",
    birthDate: "Date of birth", firstName: "First name", lastName: "Last name",
    bookings: "Bookings", rating: "Rating", noRating: "Not rated", registered: "clients registered"
  },
  bookings: {
    title: "Bookings", new: "New booking", checkIn: "Check-in", checkOut: "Check-out",
    nights: "nights", source: "Source", property: "Property", client: "Client",
    guests: "Guests", deposit: "Deposit", registered: "bookings registered",
    sources: { direct: "Direct", airbnb: "Airbnb", booking: "Booking", vrbo: "Vrbo", manual_block: "Block" },
    statuses: { confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed" },
    rating: "Stay rating", noRating: "No rating yet",
    rateStay: "★ Rate", contract: "Contract", noContract: "No contract associated",
    financials: "Financial records", noFinancials: "No financial records for this booking",
    cancel: "Cancel booking", additionalGuests: "Additional guests"
  },
  financials: {
    title: "Financials", new: "New record", income: "Income", expense: "Expense",
    category: "Category", description: "Description", amount: "Amount", registered: "financial records"
  },
  contracts: {
    title: "Contracts", new: "New contract", template: "Template", signed: "Signed",
    pending: "Pending signature", signLink: "Sign link", viewContract: "📄 View",
    registered: "contracts registered",
    statuses: { draft: "Draft", sent: "Sent", signed: "Signed", cancelled: "Cancelled" }
  },
  settings: {
    title: "Settings", subtitle: "Organization data",
    tabs: { user: "👤 User", general: "🏢 General", fiscal: "📋 Tax info", email: "📧 Email SMTP", preferences: "⚙️ Preferences" },
    logo: "Company logo", uploadLogo: "Upload logo", deleteLogo: "Delete",
    companyName: "Company name", contactEmail: "Contact email", nif: "Tax ID / VAT",
    smtp: { title: "SMTP Configuration", host: "SMTP server", port: "Port", user: "Username", pass: "Password", from: "From email", saved: "✓ saved" },
    currency: "Currency", dateFormat: "Date format", theme: "Display theme",
    themeDark: "Dark", themeLight: "Light", language: "System language",
    languageNote: "These preferences are saved in your browser and only affect your session.",
    fiscalNote: "Tax ID and address are used in contracts and generated documents."
  },
  templates: {
    title: 'Contract templates',
    new: 'New template',
    owner: 'Owner',
    ownerNif: 'Owner NIF',
    ownerAddress: 'Owner address',
    ownerSignature: 'Landlord signature',
    clauses: 'Additional clauses',
    content: 'Contract content',
    preview: '👁 Preview',
    edit: '✏️ Edit',
    variables: 'Available variables',
  },
  evaluations: {
    rate: "★ Rate stay", edit: "Edit", title: "Rate stay", editTitle: "Edit rating",
    score: "Score", comment: "Comment", commentPlaceholder: "E.g: Very careful client, left the house spotless",
    scores: ["", "Very bad", "Bad", "Average", "Good", "Excellent"],
    save: "Save rating", noRating: "No ratings", avgRating: "Average rating",
    totalBookings: "Total bookings", totalSpent: "Total spent"
  }
};

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: localStorage.getItem('language') || 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18n;
