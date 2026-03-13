const { pgTable, serial, varchar, text, timestamp, integer, boolean, decimal, date } = require('drizzle-orm/pg-core');

// Core user table
const users = pgTable("users", {
    id: serial("id").primaryKey(),
    openId: varchar("openid", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("login_method", { length: 64 }),
    role: varchar("role", { length: 20 }).default("user").notNull(),
    companyId: integer("company_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

// Companies table
const companies = pgTable("companies", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    password: text("password").notNull(), // Added for corporate login
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    country: varchar("country", { length: 100 }),
    taxId: varchar("taxId", { length: 50 }),
    registrationNumber: varchar("registrationNumber", { length: 50 }),
    website: varchar("website", { length: 255 }),
    brandColor: varchar("brandColor", { length: 20 }).default("#1a365d"),
    logoUrl: text("logoUrl"),
    employeeCount: integer("employeeCount"),
    subscriptionPlan: varchar("subscriptionPlan", { length: 50 }).default("basic"),
    isActive: boolean("isActive").default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Flight bookings table
const flightBookings = pgTable("flightBookings", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    bookingReference: varchar("bookingReference", { length: 50 }).notNull().unique(),
    departureCity: varchar("departureCity", { length: 100 }).notNull(),
    arrivalCity: varchar("arrivalCity", { length: 100 }).notNull(),
    departureDate: date("departureDate").notNull(),
    returnDate: date("returnDate"),
    passengers: integer("passengers").notNull(),
    flightClass: varchar("flightClass", { length: 50 }).default("economy"),
    totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).default("pending"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Hotel bookings table
const hotelBookings = pgTable("hotelBookings", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    bookingReference: varchar("bookingReference", { length: 50 }).notNull().unique(),
    hotelName: varchar("hotelName", { length: 255 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    checkInDate: date("checkInDate").notNull(),
    checkOutDate: date("checkOutDate").notNull(),
    rooms: integer("rooms").notNull(),
    guests: integer("guests").notNull(),
    roomType: varchar("roomType", { length: 100 }),
    totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).default("pending"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Visa requests table
const visaRequests = pgTable("visaRequests", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    requestReference: varchar("requestReference", { length: 50 }).notNull().unique(),
    passengerName: varchar("passengerName", { length: 255 }).notNull(),
    passportNumber: varchar("passportNumber", { length: 50 }).notNull(),
    nationality: varchar("nationality", { length: 100 }).notNull(),
    visaType: varchar("visaType", { length: 100 }).notNull(),
    destinationCountry: varchar("destinationCountry", { length: 100 }).notNull(),
    travelDate: date("travelDate").notNull(),
    returnDate: date("returnDate"),
    totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).default("pending"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Passengers table
const passengers = pgTable("passengers", {
    id: serial("id").primaryKey(),
    bookingId: integer("bookingId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    passportNumber: varchar("passportNumber", { length: 50 }),
    nationality: varchar("nationality", { length: 100 }),
    age: integer("age"),
    gender: varchar("gender", { length: 10 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Operations requests table for admin support
const operationsRequests = pgTable("operationsRequests", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").references(() => companies.id, { onDelete: 'cascade' }),
    type: varchar("type", { length: 50 }).notNull(), // e.g., 'refund', 'change', 'support', 'booking_failure'
    priority: varchar("priority", { length: 20 }).default("medium"),
    subject: varchar("subject", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).default("pending"), // pending, in_progress, resolved, closed
    metadata: text("metadata"), // JSON string for extra flight/hotel details
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

module.exports = {
    users,
    companies,
    flightBookings,
    hotelBookings,
    visaRequests,
    passengers,
    operationsRequests
};
