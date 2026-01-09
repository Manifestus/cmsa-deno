# CMSA Deno Backend (cmsa-deno)

Backend API for **Clínicas Médicas Santa Ana (CMSA)** built with **Deno**, **PostgreSQL**, and modern API practices.

This service provides authentication, role-based access control, clinical modules, billing, inventory, and **cash register (cash session) management**.  
It is designed to be consumed by the **cmsa-next** frontend and deployed later to **AWS**.

---

## 🧱 Tech Stack

- **Deno** (runtime)
- **PostgreSQL** (primary database)
- **Prisma** (ORM)
- **REST API** architecture
- **RBAC** (Role-Based Access Control)
- **JWT Authentication**
- **Docker-ready**
- **AWS-ready** (ECS / RDS planned)

---

## 📁 Project Structure

```text
cmsa-deno/
├── prisma/
│   ├── schema.prisma
│   └── src/generated/
├── src/
│   ├── api/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── patients/
│   │   ├── inventory/
│   │   ├── billing/
│   │   └── cash/
│   │       ├── open.ts
│   │       ├── close.ts
│   │       └── sessions.ts
│   ├── middlewares/
│   ├── utils/
│   └── main.ts
├── .env
├── deno.json
└── README.md
```

---

## 🔐 Roles (RBAC)

| Role | Permissions |
|-----|------------|
| **Admin** | Full system access |
| **Servicio al Cliente** | Create consultations, open/close cash |
| **Veterinario** | Consultations, diagnostics, treatments |
| **Cliente** | View own records |

---

## 💰 Cash Register (Caja)

Implemented using **cash sessions**:

- Open cash session
- Register transactions (income/expenses)
- Close cash session
- Prevent multiple open sessions
- PostgreSQL enforced consistency

### Endpoints (example)

```http
POST /api/cash/sessions/open
POST /api/cash/sessions/:id/close
GET  /api/cash/sessions
```

> ⚠️ Closing a cash session **must be a POST**, not GET.

---

## 🧪 Local Development

### 1. Install Deno

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### 2. Environment variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cmsa
JWT_SECRET=supersecret
```

### 3. Prisma

```bash
deno task prisma:generate
deno task prisma:migrate
```

### 4. Run the API

```bash
deno task dev
```

API will run at:

```
http://localhost:8000
```

---

## 🐳 Docker (optional)

```bash
docker build -t cmsa-deno .
docker run -p 8000:8000 cmsa-deno
```

---

## 🔗 Frontend

Frontend lives in a separate project:

- **Folder**: `cmsa-next`
- **Framework**: Next.js
- **Communication**: REST API

---

## ☁️ Deployment (Next Chapter)

Planned AWS architecture:

- ECS (Fargate)
- RDS PostgreSQL
- ALB
- Secrets Manager
- CI/CD via GitHub Actions

---

## 📌 Notes

- Code is written in **English**
- UX/UI text is in **Spanish**
- Designed for medical clinic workflows
- Built step-by-step with scalability in mind

---

## 👤 Author

**Victor Figueroa**  
Clínicas Médicas Santa Ana (CMSA)

