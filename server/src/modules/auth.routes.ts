import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, signToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { prisma } from '../prisma';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, created, ok } from '../utils/http';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS']),
});

/** POST /api/auth/login */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Same message for "no such user" and "wrong password" — do not leak which emails exist.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    if (!user.isActive) {
      throw ApiError.forbidden('This account has been deactivated');
    }

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    return ok(res, { token: signToken(payload), user: payload });
  }),
);

/** GET /api/auth/me */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    if (!user) throw ApiError.notFound('User no longer exists');
    return ok(res, user);
  }),
);

/** POST /api/auth/register — admin-only user provisioning */
router.post(
  '/register',
  authenticate,
  requireRole(),
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body as z.infer<typeof registerSchema>;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase(), passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return created(res, user);
  }),
);

/** GET /api/auth/users — admin-only listing */
router.get(
  '/users',
  authenticate,
  requireRole(),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return ok(res, users);
  }),
);

export default router;
