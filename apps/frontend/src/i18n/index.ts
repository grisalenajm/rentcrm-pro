import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const es = {
  nav: {
    dashboard: "Dashboard", properties: "Propiedades", clients: "Clientes",
    bookings: "Reservas", financials: "Financiero", contracts: "Contratos",
    templates: "Templates", calendar: "Calendario", police: "Partes SES", transmision: "Transmisión de datos", users: "Usuarios", settings: "Configuración"
  },
  common: {
    save: "Guardar cambios", saving: "Guardando...", saved: "✅ Guardado",
    cancel: "Cancelar", delete: "Eliminar", edit: "Editar", create: "Crear",
    search: "Buscar", loading: "Cargando...", noData: "Sin datos registrados",
    back: "← Volver", actions: "Acciones", new: "Nuevo", view: "Ver",
    send: "Enviar", close: "Cerrar", name: "Nombre", email: "Email",
    phone: "Teléfono", address: "Dirección", city: "Ciudad", date: "Fecha",
    total: "Total", status: "Estado", notes: "Notas", type: "Tipo", confirm_delete: "¿Estás seguro de que quieres eliminar este registro?"
  },
  dashboard: {
    title: "Dashboard", totalRevenue: "Ingresos totales", activeBookings: "Reservas activas",
    totalProperties: "Propiedades", totalClients: "Clientes",
    recentBookings: "Reservas recientes", occupancyRate: "Tasa de ocupación"
  },
  properties: {
    title: "Propiedades", new: "Nueva propiedad", rooms: "Habitaciones", province: "Provincia", registered: "propiedades registradas",
    ical: {
      sectionTitle: "Sincronización iCal",
      addFeed: "Añadir feed",
      addFeedTitle: "Nuevo feed iCal",
      platform: "Plataforma",
      icalUrl: "URL del calendario iCal",
      icalUrlHint: "Copia la URL iCal desde la configuración de Airbnb o Booking.com",
      other: "Otra",
      save: "Guardar",
      saving: "Guardando...",
      cancel: "Cancelar",
      loading: "Cargando feeds...",
      noFeeds: "No hay feeds configurados",
      noFeedsHint: "Añade un feed para importar reservas automáticamente",
      lastSync: "Última sincronización",
      neverSynced: "Nunca sincronizado",
      sync: "Sincronizar",
      syncResult: "Importadas: {{imported}} · Omitidas: {{skipped}} · Total: {{total}}",
      exportUrl: "URL de exportación",
      copy: "Copiar",
      copied: "¡Copiado!",
      confirmDelete: "¿Eliminar este feed?",
      errorRequired: "La URL es obligatoria",
      errorSave: "Error al guardar el feed",
      errorSync: "Error al sincronizar",
    },
  },
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
    statuses: { pending: "Pendiente", confirmed: "Confirmada", cancelled: "Cancelada", completed: "Completada", created: "Creada", registered: "Registrada", processed: "Procesada", error: "Error" },
    rating: "Valoración de la estancia", noRating: "Sin valoración todavía",
    rateStay: "★ Valorar", contract: "Contrato", noContract: "No hay contrato asociado",
    financials: "Registros financieros", noFinancials: "No hay registros financieros para esta reserva",
    cancel: "Cancelar reserva", additionalGuests: "Huéspedes adicionales",
    welcomePackage: "Welcome Package", sendWelcome: "📨 Enviar Welcome Package",
    welcomeSentAt: "Enviado el", welcomeNotSent: "No enviado", welcomeSending: "Enviando..."
  },
  content: {
    template: "Plantilla del email",
    insertVariable: "Insertar variable",
    guestName: "Nombre huésped",
    propertyName: "Nombre propiedad",
    usingGlobalTemplate: "Usando plantilla global",
    globalContent: "Contenido global", propertyContent: "Contenido de la propiedad",
    documents: "Documentos PDF adjuntos", uploadPdf: "Subir PDF", noContent: "Sin contenido configurado",
    save: "Guardar plantilla", saving: "Guardando...", saved: "✅ Guardado",
    deleteDoc: "Eliminar", noDocuments: "No hay documentos",
  },
  financials: {
    title: "Financiero", new: "Nuevo registro", income: "Ingreso", expense: "Gasto",
    category: "Categoría", description: "Descripción", amount: "Importe", registered: "registros financieros"
  },
  contracts: {
    title: "Contratos", new: "Nuevo contrato", template: "Template", signed: "Firmado",
    pending: "Pendiente de firma", signLink: "Link de firma", viewContract: "📄 Ver", resend: "Reenviar",
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
    totalBookings: "Reservas totales", totalSpent: "Total gastado", lastStay: "Última estancia"
  },
  calendar: {
    title: "Calendario de ocupacion",
    subtitle: "Visualiza la ocupacion de tus propiedades",
    viewMulti: "Multi-propiedad",
    viewMonthly: "Mensual",
    property: "Propiedad",
    confirmed: "Confirmada",
    pending: "Pendiente",
    cancelled: "Cancelada",
    loading: "Cargando calendario..."
  },
  users: {
    title: "Usuarios",
    new: "Nuevo usuario",
    role: "Rol",
    roles: { admin: "Administrador", gestor: "Gestor", viewer: "Consultor" },
    active: "Activo",
    inactive: "Inactivo",
    activate: "Activar",
    deactivate: "Desactivar",
    resetPassword: "Resetear contraseña",
    resetPasswordConfirm: "¿Resetear la contraseña de este usuario? Se generará una contraseña temporal.",
    tempPassword: "Contraseña temporal generada",
    copyPassword: "Copiar",
    registered: "usuarios registrados",
    password: "Contraseña (mín. 8 caracteres)",
    editUser: "Editar usuario",
    newUser: "Nuevo usuario",
    confirmDeactivate: "¿Desactivar este usuario?",
    confirmActivate: "¿Activar este usuario?",
  },
  session: {
    expiredTitle: "Sesión expirada",
    expiredMessage: "Tu sesión ha expirado. Por favor, inicia sesión de nuevo.",
    redirecting: "Redirigiendo al login en {{seconds}} segundos...",
    loginAgain: "Iniciar sesión ahora",
    idleTitle: "¿Sigues ahí?",
    idleMessage: "Tu sesión está a punto de expirar por inactividad.",
    idleCountdown: "Cierre de sesión automático en {{seconds}} segundos.",
    continueSession: "Continuar",
    logoutNow: "Cerrar sesión",
  }
};

const en = {
  nav: {
    dashboard: "Dashboard", properties: "Properties", clients: "Clients",
    bookings: "Bookings", financials: "Financials", contracts: "Contracts",
    templates: "Templates", calendar: "Calendar", police: "Guest Reports", transmision: "Data Transmission", users: "Users", settings: "Settings"
  },
  common: {
    save: "Save changes", saving: "Saving...", saved: "✅ Saved",
    cancel: "Cancel", delete: "Delete", edit: "Edit", create: "Create",
    search: "Search", loading: "Loading...", noData: "No data registered",
    back: "← Back", actions: "Actions", new: "New", view: "View",
    send: "Send", close: "Close", name: "Name", email: "Email",
    phone: "Phone", address: "Address", city: "City", date: "Date",
    total: "Total", status: "Status", notes: "Notes", type: "Type", confirm_delete: "Are you sure you want to delete this record?"
  },
  dashboard: {
    title: "Dashboard", totalRevenue: "Total revenue", activeBookings: "Active bookings",
    totalProperties: "Properties", totalClients: "Clients",
    recentBookings: "Recent bookings", occupancyRate: "Occupancy rate"
  },
  properties: {
    title: "Properties", new: "New property", rooms: "Rooms", province: "Province", registered: "properties registered",
    ical: {
      sectionTitle: "iCal Sync",
      addFeed: "Add feed",
      addFeedTitle: "New iCal feed",
      platform: "Platform",
      icalUrl: "iCal calendar URL",
      icalUrlHint: "Copy the iCal URL from your Airbnb or Booking.com settings",
      other: "Other",
      save: "Save",
      saving: "Saving...",
      cancel: "Cancel",
      loading: "Loading feeds...",
      noFeeds: "No feeds configured",
      noFeedsHint: "Add a feed to automatically import bookings",
      lastSync: "Last sync",
      neverSynced: "Never synced",
      sync: "Sync",
      syncResult: "Imported: {{imported}} · Skipped: {{skipped}} · Total: {{total}}",
      exportUrl: "Export URL",
      copy: "Copy",
      copied: "Copied!",
      confirmDelete: "Delete this feed?",
      errorRequired: "URL is required",
      errorSave: "Error saving feed",
      errorSync: "Error syncing feed",
    },
  },
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
    statuses: { pending: "Pending", confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed", created: "Created", registered: "Registered", processed: "Processed", error: "Error" },
    rating: "Stay rating", noRating: "No rating yet",
    rateStay: "★ Rate", contract: "Contract", noContract: "No contract associated",
    financials: "Financial records", noFinancials: "No financial records for this booking",
    cancel: "Cancel booking", additionalGuests: "Additional guests",
    welcomePackage: "Welcome Package", sendWelcome: "📨 Send Welcome Package",
    welcomeSentAt: "Sent on", welcomeNotSent: "Not sent", welcomeSending: "Sending..."
  },
  content: {
    template: "Email template",
    insertVariable: "Insert variable",
    guestName: "Guest name",
    propertyName: "Property name",
    usingGlobalTemplate: "Using global template",
    globalContent: "Global content", propertyContent: "Property content",
    documents: "Attached PDF documents", uploadPdf: "Upload PDF", noContent: "No content configured",
    save: "Save template", saving: "Saving...", saved: "✅ Saved",
    deleteDoc: "Delete", noDocuments: "No documents",
  },
  financials: {
    title: "Financials", new: "New record", income: "Income", expense: "Expense",
    category: "Category", description: "Description", amount: "Amount", registered: "financial records"
  },
  contracts: {
    title: "Contracts", new: "New contract", template: "Template", signed: "Signed",
    pending: "Pending signature", signLink: "Sign link", viewContract: "📄 View", resend: "Resend",
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
    totalBookings: "Total bookings", totalSpent: "Total spent", lastStay: "Last stay"
  },
  calendar: {
    title: "Occupancy Calendar",
    subtitle: "Visualize the occupancy of your properties",
    viewMulti: "Multi-property",
    viewMonthly: "Monthly",
    property: "Property",
    confirmed: "Confirmed",
    pending: "Pending",
    cancelled: "Cancelled",
    loading: "Loading calendar..."
  },
  users: {
    title: "Users",
    new: "New user",
    role: "Role",
    roles: { admin: "Admin", gestor: "Manager", viewer: "Viewer" },
    active: "Active",
    inactive: "Inactive",
    activate: "Activate",
    deactivate: "Deactivate",
    resetPassword: "Reset password",
    resetPasswordConfirm: "Reset this user's password? A temporary password will be generated.",
    tempPassword: "Generated temporary password",
    copyPassword: "Copy",
    registered: "users registered",
    password: "Password (min. 8 characters)",
    editUser: "Edit user",
    newUser: "New user",
    confirmDeactivate: "Deactivate this user?",
    confirmActivate: "Activate this user?",
  },
  session: {
    expiredTitle: "Session expired",
    expiredMessage: "Your session has expired. Please log in again.",
    redirecting: "Redirecting to login in {{seconds}} seconds...",
    loginAgain: "Log in now",
    idleTitle: "Still there?",
    idleMessage: "Your session is about to expire due to inactivity.",
    idleCountdown: "Automatic logout in {{seconds}} seconds.",
    continueSession: "Continue",
    logoutNow: "Log out",
  }
};

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: localStorage.getItem('language') || 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18n;
