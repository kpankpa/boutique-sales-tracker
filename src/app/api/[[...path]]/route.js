import { NextResponse } from 'next/server';
import { ensureSchema } from '../../../models/database';
import { AppError } from '../../../models/errors';
import { getSetting, isInstalled } from '../../../models/repositories/settings';
import { listBranches } from '../../../models/repositories/branches';
import { listCategories } from '../../../models/repositories/categories';
import { listProducts } from '../../../models/repositories/products';
import { listCustomers } from '../../../models/repositories/customers';
import { listSales } from '../../../models/repositories/sales';
import { listUsers } from '../../../models/repositories/users';
import { listAudit, listOutboxEvents, listStock } from '../../../models/repositories/activity';
import { exportCustomers } from '../../../models/repositories/customers';
import { signIn, signOut, signedInUser } from '../../../models/services/authService';
import { checkLoginLock, clearFailedLogins, loginKey, noteFailedLogin } from '../../../models/services/loginGuard';
import { currentSession } from '../../../models/session';
import { installApplication, prepareDatabase } from '../../../models/services/installer';
import {
  createBranch,
  createCategory,
  createCustomer,
  createProduct,
  createUser,
  deactivateCustomer,
  editBranch,
  editProduct
} from '../../../models/services/adminService';
import { recordSale } from '../../../models/services/saleService';
import { adjustStockFromInput } from '../../../models/services/stockService';
import { dailySummary, lowStock } from '../../../models/services/reportService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ok(data = {}) {
  return NextResponse.json(data);
}

function fail(message, status = 400, details = {}, headers = {}) {
  return NextResponse.json({ error: message, ...details }, { status, headers });
}

function requireAdmin(user) {
  return user.role === 'admin' ? null : fail('Admin access is required.', 403);
}

function branchFilter(request, user) {
  const requested = request.nextUrl.searchParams.get('branchId');
  if (user.role === 'cashier') return user.branchId;
  return requested ? Number(requested) : null;
}

async function handle(request, context) {
  const { path = [] } = await context.params;
  const key = path.join('/');
  const method = request.method;
  await ensureSchema();
  const installed = await isInstalled();

  const isStatus = key === 'status' && method === 'GET';
  const isInstall = key === 'install' && method === 'POST';

  if (!installed && !isStatus && !isInstall) {
    return fail('The application has not been installed yet.', 503);
  }
  if (installed && isInstall) {
    return fail('This application has already been installed.', 403);
  }

  try {
    if (key === 'status' && method === 'GET') {
      const databaseUrl = process.env.DATABASE_URL || 'file:data/pos.db';
      const databaseLabel = databaseUrl.startsWith('file:')
        ? 'Local SQLite file'
        : 'Hosted libSQL database';
      return ok({
        installed,
        database: databaseLabel,
        companyName: installed ? await getSetting('company_name') : null
      });
    }

    if (key === 'install' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (body.action === 'prepare') {
        await prepareDatabase();
        return ok({ ready: true });
      }
      if (body.action === 'finish') {
        const result = await installApplication(body);
        return ok(result);
      }
      return fail('Unknown installer action.');
    }

    if (key === 'auth/login' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const attemptKey = loginKey(request, body.username);
      const previous = await checkLoginLock(attemptKey);
      try {
        const user = await signIn(body);
        await clearFailedLogins(attemptKey);
        return ok({ user });
      } catch (failure) {
        if (failure instanceof AppError && failure.code === 'INVALID_CREDENTIALS') {
          await noteFailedLogin(attemptKey, previous);
        }
        throw failure;
      }
    }

    if (key === 'auth/logout' && method === 'POST') {
      await signOut();
      return ok();
    }

    const user = await signedInUser();
    if (!user) return fail('Please sign in.', 401);

    if (key === 'auth/me' && method === 'GET') {
      const session = await currentSession();
      return ok({ user, expiresAt: session?.expiresAt ?? null });
    }

    if (key === 'meta' && method === 'GET') {
      const branches = await listBranches();
      const visible = user.role === 'cashier'
        ? branches.filter((branch) => branch.id === user.branchId)
        : branches;
      return ok({ branches: visible, companyName: await getSetting('company_name') });
    }

    if (key === 'categories' && method === 'GET') return ok(await listCategories());
    if (key === 'categories' && method === 'POST') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      return ok(await createCategory(body));
    }

    if (key === 'products' && method === 'GET') return ok(await listProducts());
    if (key === 'products' && method === 'POST') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      return ok(await createProduct(body));
    }
    if (key === 'products/update' && method === 'POST') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      return ok(await editProduct(body));
    }

    if (key === 'customers' && method === 'GET') {
      const search = request.nextUrl.searchParams.get('q') || '';
      return ok(await listCustomers(search));
    }
    if (key === 'customers' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return ok({ id: await createCustomer(body) });
    }
    if (key === 'customers/export' && method === 'GET') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      return ok(await exportCustomers());
    }
    if (key === 'customers/deactivate' && method === 'POST') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      return ok(await deactivateCustomer(user, body));
    }

    if (key === 'sales' && method === 'GET') {
      const limit = Number(request.nextUrl.searchParams.get('limit')) || 100;
      return ok(await listSales({ branchId: branchFilter(request, user), limit }));
    }
    if (key === 'sales' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return ok(await recordSale(user, body));
    }

    if (key === 'reports/daily' && method === 'GET') {
      return ok(await dailySummary(branchFilter(request, user)));
    }

    if (key === 'stock/low' && method === 'GET') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      return ok(await lowStock());
    }

    if (key === 'stock' && method === 'GET') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      return ok(await listStock());
    }
    if (key === 'stock' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return ok(await adjustStockFromInput(user, body));
    }

    if (key === 'users' && method === 'GET') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      return ok(await listUsers());
    }
    if (key === 'users' && method === 'POST') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      return ok({ id: await createUser(body) });
    }

    if (key === 'branches' && method === 'GET') return ok(await listBranches());
    if (key === 'branches' && method === 'POST') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      return ok({ id: await createBranch(body) });
    }
    if (key === 'branches/update' && method === 'POST') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      return ok(await editBranch(body));
    }

    if (key === 'outbox' && method === 'GET') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      return ok(await listOutboxEvents());
    }

    if (key === 'audit' && method === 'GET') {
      const denied = requireAdmin(user);
      if (denied) return denied;
      return ok(await listAudit());
    }

    return fail('Endpoint not found.', 404);
  } catch (failure) {
    if (failure instanceof AppError) {
      const locked = failure.code === 'LOGIN_LOCKED';
      return fail(
        failure.message,
        locked ? 429 : 400,
        { code: failure.code, details: failure.details },
        locked ? { 'Retry-After': '900' } : {}
      );
    }
    console.error(`[api] ${method} /api/${key}`, failure);
    return fail(
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : failure.message || 'Something went wrong.',
      500,
      { code: 'INTERNAL_ERROR' }
    );
  }
}

export const GET = handle;
export const POST = handle;
