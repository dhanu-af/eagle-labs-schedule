import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";

const COOKIE_NAME = "eagle_session";
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-only-secret"
);

const FAILED_LOGIN_LOCK_THRESHOLD = 5;
const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30; // 30 days
const SESSION_MAX_AGE_DEFAULT = 60 * 60 * 24; // 1 day

export type SessionPayload = {
  userId: string;
  username: string;
  role: Role;
  employeeId: string | null;
  fullName: string;
  isPermanent: boolean;
  mustChangePassword: boolean;
  loginEventId: string | null;
};

export function isAdminRole(role: Role) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Manager-tier: can *view* admin surfaces (Team, Payroll, Reports, Audit). */
export function canManageRole(role: Role) {
  return (
    role === "ADMIN" ||
    role === "SUPERVISOR" ||
    role === "OPERATIONS" ||
    role === "SUPER_ADMIN"
  );
}

/** Checks module: who can submit/approve the Supervisor-owned steps. */
export function canActAsSupervisor(role: Role) {
  return (
    role === "SUPERVISOR" ||
    role === "OPERATIONS" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN"
  );
}

/** Checks module: who can submit/approve the QA-owned steps. */
export function canActAsQa(role: Role) {
  return role === "QA" || role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Checks module: who can submit day-to-day operator records (post-op cleaning, environmental readings). */
export function canActAsOperator(role: Role) {
  return (
    role === "EMPLOYEE" ||
    role === "SUPERVISOR" ||
    role === "OPERATIONS" ||
    role === "QA" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN"
  );
}

/** Checks module: who can unlock a record after QA approval to allow edits. */
export function canUnlockChecks(role: Role) {
  return isAdminRole(role);
}

/** Only the Super Admin can create, update, delete, or approve anything. */
export function canEdit(role: Role) {
  return role === "SUPER_ADMIN";
}

/** Checks module — Work Log: any employee can fill it in, but only Supervisor or Super Admin (not plain Admin) can approve. */
export function canApproveWorkLog(role: Role) {
  return role === "SUPERVISOR" || role === "OPERATIONS" || role === "SUPER_ADMIN";
}

/** KPI daily production details (batch weight, fill weight, capsule/bottle counts): Supervisor or Super Admin only. */
export function canEditKpiProduction(role: Role) {
  return role === "SUPERVISOR" || role === "OPERATIONS" || role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Encapsulation machine speed (Hz): Super Admin only — everyone else with KPI production access can view it. */
export function canEditMachineSpeed(role: Role) {
  return role === "SUPER_ADMIN";
}

/** Drying Room: destructive actions (delete batch/misc item) restricted like the Daily Planner's manage permission. Status/quick-action updates use canUpdateDailyProgress instead, open to every operator. */
export function canManageDryingRoom(role: Role) {
  return (
    role === "SUPERVISOR" ||
    role === "OPERATIONS" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN"
  );
}

/**
 * Daily Planner: any authenticated employee may update a task's actual
 * production quantity and move its status (e.g. via "Move to..."), even
 * though they can't create/edit/delete tasks or duplicate a day — an
 * intentional, narrow exception to the Super-Admin-only rule above so
 * floor operators can log their own progress in real time.
 */
export function canUpdateDailyProgress(_role: Role) {
  return true;
}

/** Dashboard: any authenticated employee may post an announcement for all staff. */
export function canPostAnnouncement(_role: Role) {
  return true;
}

/** Team Chat: open to every authenticated employee. */
export function canUseTeamChat(_role: Role) {
  return true;
}

/**
 * Daily Planner: Supervisors (and Admin/Super Admin) can create, edit
 * (including batch numbers) and duplicate tasks — a further intentional
 * exception to the Super-Admin-only rule, since Supervisors are the ones
 * actually scheduling and re-batching daily production.
 */
export function canManageDailyPlanner(role: Role) {
  return (
    role === "SUPERVISOR" ||
    role === "OPERATIONS" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN"
  );
}

/** Warehouse: manager tier — item/location CRUD, release stock to production, verify returns. No dedicated WAREHOUSE role exists; mirrors canManageDryingRoom's precedent. */
export function canManageWarehouse(role: Role) {
  return (
    role === "SUPERVISOR" ||
    role === "OPERATIONS" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN"
  );
}

/** Warehouse: any production-floor operator can create a material request and confirm materials received. Excludes OTHERS (restricted external role, see app-shell's separate nav view). */
export function canRequestMaterials(role: Role) {
  return (
    role === "EMPLOYEE" ||
    role === "SUPERVISOR" ||
    role === "OPERATIONS" ||
    role === "QA" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN"
  );
}

/** Warehouse: QA release of quarantined Goods Receiving lines into Available stock. */
export function canQaReleaseStock(role: Role) {
  return role === "QA" || role === "ADMIN" || role === "SUPER_ADMIN";
}

/** QC Sample Management: manager tier — record edits, retention management, delete (pre-lab-result only).
 * Includes EXTRA -- that role's nav is otherwise limited to Production Staging Operations and QC Samples,
 * but its account (e.g. "Wood") is trusted with full edit access on QC records, not just collection. */
export function canManageQcSamples(role: Role) {
  return (
    role === "QA" ||
    role === "SUPERVISOR" ||
    role === "OPERATIONS" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "EXTRA"
  );
}

/** QC Sample Management: any production-floor operator can generate/collect a sample and mark it sent to lab.
 * Includes EXTRA -- that role's nav is otherwise limited to Production Staging Operations only, but its
 * account (e.g. "Wood") also handles QC sampling duties on the floor. */
export function canCollectQcSamples(role: Role) {
  return (
    role === "EMPLOYEE" ||
    role === "SUPERVISOR" ||
    role === "OPERATIONS" ||
    role === "QA" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "EXTRA"
  );
}

/** QC Sample Management: entering lab test results and approving/rejecting a sample -- normally QA-only,
 * but EXTRA is included too per explicit request so that role gets every workflow action on this module,
 * not just collection and general edits. */
export function canRunLabTesting(role: Role) {
  return role === "QA" || role === "ADMIN" || role === "SUPER_ADMIN" || role === "EXTRA";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

async function getRequestMeta() {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const userAgent = h.get("user-agent") || "unknown";
  return { ip, userAgent };
}

export async function createSession(payload: SessionPayload, remember = false) {
  const maxAge = remember ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE_DEFAULT;
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string, remember = false) {
  const { ip, userAgent } = await getRequestMeta();

  const user = await prisma.user.findUnique({
    where: { username },
    include: { employee: true },
  });

  if (!user) {
    await prisma.loginEvent.create({
      data: { username, status: "FAILED", ipAddress: ip, userAgent },
    });
    return { error: "Invalid User ID or password" as const };
  }

  const logFailed = () =>
    prisma.loginEvent.create({
      data: {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        status: "FAILED",
        ipAddress: ip,
        userAgent,
      },
    });

  if (user.locked) {
    await logFailed();
    return { error: "This account is locked due to repeated failed attempts. Contact your Super Admin to unlock it." as const };
  }

  if (user.disabled) {
    await logFailed();
    return { error: "This account has been disabled. Contact your Super Admin." as const };
  }

  if (user.employee && !user.employee.active) {
    await logFailed();
    return { error: "Your account has been deactivated." as const };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= FAILED_LOGIN_LOCK_THRESHOLD;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, locked: shouldLock },
    });
    await logFailed();
    return {
      error: shouldLock
        ? "Too many failed attempts. This account is now locked — contact your Super Admin to unlock it."
        : ("Invalid User ID or password" as const),
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0 },
  });

  const loginEvent = await prisma.loginEvent.create({
    data: {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      status: "SUCCESS",
      ipAddress: ip,
      userAgent,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      summary: `${user.fullName} (${user.username}) logged in`,
    },
  });

  await createSession(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employeeId,
      fullName: user.fullName,
      isPermanent: user.isPermanent,
      mustChangePassword: user.mustChangePassword,
      loginEventId: loginEvent.id,
    },
    remember
  );

  return { ok: true as const, mustChangePassword: user.mustChangePassword };
}

export async function logout() {
  const session = await getSession();
  if (session) {
    if (session.loginEventId) {
      const event = await prisma.loginEvent.findUnique({ where: { id: session.loginEventId } });
      if (event && !event.logoutAt) {
        await prisma.loginEvent.update({
          where: { id: session.loginEventId },
          data: { logoutAt: new Date() },
        });
      }
    }
    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        actorName: session.fullName,
        actorRole: session.role,
        action: "LOGOUT",
        entityType: "User",
        entityId: session.userId,
        summary: `${session.fullName} (${session.username}) logged out`,
      },
    });
  }
  await destroySession();
}
