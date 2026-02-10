const { drizzle } = require('drizzle-orm/node-postgres');
const pool = require('../config/database');
const schema = require('../db/schema');
const { migrate } = require('drizzle-orm/node-postgres/migrator');

async function init() {
    console.log('🚀 Starting Database Initialization...');

    const db = drizzle(pool, { schema });

    const sql = `
    CREATE TABLE IF NOT EXISTS "companies" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" varchar(255) NOT NULL,
        "email" varchar(320) NOT NULL UNIQUE,
        "password" text NOT NULL,
        "phone" varchar(20),
        "address" text,
        "city" varchar(100),
        "country" varchar(100),
        "taxId" varchar(50),
        "employeeCount" integer,
        "subscriptionPlan" varchar(50) DEFAULT 'basic',
        "isActive" boolean DEFAULT true,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "flightBookings" (
        "id" serial PRIMARY KEY NOT NULL,
        "companyId" integer NOT NULL,
        "bookingReference" varchar(50) NOT NULL UNIQUE,
        "departureCity" varchar(100) NOT NULL,
        "arrivalCity" varchar(100) NOT NULL,
        "departureDate" date NOT NULL,
        "returnDate" date,
        "passengers" integer NOT NULL,
        "flightClass" varchar(50) DEFAULT 'economy',
        "totalPrice" decimal(10, 2) NOT NULL,
        "status" varchar(50) DEFAULT 'pending',
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "hotelBookings" (
        "id" serial PRIMARY KEY NOT NULL,
        "companyId" integer NOT NULL,
        "bookingReference" varchar(50) NOT NULL UNIQUE,
        "hotelName" varchar(255) NOT NULL,
        "city" varchar(100) NOT NULL,
        "checkInDate" date NOT NULL,
        "checkOutDate" date NOT NULL,
        "rooms" integer NOT NULL,
        "guests" integer NOT NULL,
        "roomType" varchar(100),
        "totalPrice" decimal(10, 2) NOT NULL,
        "status" varchar(50) DEFAULT 'pending',
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "visaRequests" (
        "id" serial PRIMARY KEY NOT NULL,
        "companyId" integer NOT NULL,
        "requestReference" varchar(50) NOT NULL UNIQUE,
        "passengerName" varchar(255) NOT NULL,
        "passportNumber" varchar(50) NOT NULL,
        "nationality" varchar(100) NOT NULL,
        "visaType" varchar(100) NOT NULL,
        "destinationCountry" varchar(100) NOT NULL,
        "travelDate" date NOT NULL,
        "returnDate" date,
        "totalPrice" decimal(10, 2) NOT NULL,
        "status" varchar(50) DEFAULT 'pending',
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "passengers" (
        "id" serial PRIMARY KEY NOT NULL,
        "bookingId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "passportNumber" varchar(50),
        "nationality" varchar(100),
        "age" integer,
        "gender" varchar(10),
        "createdAt" timestamp DEFAULT now() NOT NULL
    );
  `;

    try {
        await pool.query(sql);
        console.log('✅ All tables created successfully!');
    } catch (err) {
        console.error('❌ Error creating tables:', err.message);
    } finally {
        await pool.end();
        process.exit();
    }
}

init();
