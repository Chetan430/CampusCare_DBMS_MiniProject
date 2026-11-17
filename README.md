# CampusCare — Campus Maintenance Management System

### DBMS Mini Project | Level 3

### Developed By
**CHETAN (PES2UG24CS131)**  
**GOWTHAM L (PES2UG24CS171)**

---

## Project Overview

CampusCare is a web-based Campus Maintenance Management System designed to simplify the reporting, tracking, assignment, and resolution of maintenance complaints within an educational institution.

The application integrates a relational database with automated workflows, role-based access control, and vector-based duplicate complaint detection.

## Technologies Used

| Technology | Purpose |
|---|---|
| Next.js 14 | Frontend and backend development |
| React.js | Interactive user interfaces |
| TypeScript | Application development |
| PostgreSQL | Relational database management |
| Prisma ORM | Database connectivity |
| pgvector | Vector storage and similarity search |
| MiniLM | Text embedding generation |
| Docker | PostgreSQL containerization |
| NextAuth.js | Authentication |
| Tailwind CSS | User interface styling |
| Zod | Input validation |

## Key Features

### Student Dashboard
- Submit maintenance complaints.
- Select complaint category, location, and priority.
- Track complaint status.
- Identify potentially duplicate complaints.
- Provide feedback after resolution.

### Administrator Dashboard
- View and manage registered complaints.
- Assign complaints to technicians.
- Automatically assign technicians based on skills and workload.
- Monitor technician workload.
- Identify SLA violations.
- Analyze recurring maintenance issues.

### Technician Dashboard
- View assigned maintenance complaints.
- Update complaint status.
- Record maintenance activities.
- Mark complaints as resolved.

### Duplicate Complaint Detection
- Converts complaint descriptions into 384-dimensional vectors.
- Uses MiniLM embeddings when available.
- Supports an offline lexical embedding fallback.
- Stores embeddings using PostgreSQL's pgvector extension.
- Uses cosine similarity to identify potentially duplicate complaints.
- Implements HNSW indexing for efficient vector similarity searches.

## Advanced DBMS Concepts Implemented

1. Relational database design
2. Primary keys and foreign keys
3. Database normalization
4. SQL joins and aggregate functions
5. Database constraints
6. Stored functions using PL/pgSQL
7. Database triggers
8. Database views
9. Transactions and ACID properties
10. Indexing and query optimization
11. Vector similarity search using pgvector
12. Role-based access control

## Database Architecture

The application uses eight main relational tables:

- `users`
- `tickets`
- `categories`
- `locations`
- `assignments`
- `status_history`
- `feedback`
- `duplicate_links`

### Database Triggers

**SLA Calculation Trigger:** Automatically calculates complaint resolution deadlines based on maintenance categories.

**Status History Trigger:** Records complaint status changes to maintain an audit trail.

### Stored Function

**Automatic Technician Assignment:** Assigns complaints to qualified technicians based on their skills and current workload.

### Database Views

- `technician_workload`
- `sla_breach_report`
- `recurring_issue_hotspots`

## Project Structure

```text
CampusCare_DBMS_MiniProject/
│
├── README.md
│
└── campuscare/
    ├── app/
    ├── components/
    ├── lib/
    ├── prisma/
    ├── scripts/
    ├── sql/
    ├── docs/
    ├── tests/
    ├── docker-compose.yml
    ├── package.json
    └── README.md
```

## Installation and Setup

### Prerequisites

- Node.js and npm
- Docker Desktop
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/Chetan430/CampusCare_DBMS_MiniProject.git
```

### Step 2: Navigate to the Application

```bash
cd CampusCare_DBMS_MiniProject/campuscare
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Start Docker Desktop

Ensure Docker Desktop is running before proceeding.

### Step 5: Configure the Database

```bash
npm run setup:fresh
```

This command initializes the PostgreSQL database, configures Prisma, creates database objects, seeds demonstration data, and performs database smoke tests.

### Step 6: Start the Application

```bash
npm run dev
```

The application runs locally on port `3100`.

## Demonstration Accounts

| Role | Email |
|---|---|
| Student | student1@campuscare.edu |
| Administrator | admin@campuscare.edu |
| Electrical Technician | tech.electrical@campuscare.edu |
| IT Technician | tech.it@campuscare.edu |
| Facilities Technician | tech.facilities@campuscare.edu |

**Demo password:** `password123`

These credentials are intended for local demonstrations only.

## Project Objective

The primary objective of CampusCare is to develop a centralized maintenance management platform that improves complaint tracking, automates technician assignment, maintains database integrity, and reduces duplicate complaint handling.

The project demonstrates the practical implementation of advanced DBMS concepts using PostgreSQL and modern web technologies.

## Conclusion

CampusCare combines traditional relational database management with automated workflows and vector-based similarity search.

The system demonstrates how PostgreSQL, pgvector, stored functions, triggers, transactions, and database views can be integrated into a real-world maintenance management application.

---

**Project:** CampusCare — DBMS Mini Project  
**Level:** 3  
**Database:** PostgreSQL  
**Framework:** Next.js  

**Developed By:**  
**CHETAN — PES2UG24CS131**  
**GOWTHAM L — PES2UG24CS171**
