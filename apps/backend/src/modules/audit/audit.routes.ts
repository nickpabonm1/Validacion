import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { fromJsonField } from "../../lib/json-field";
import { requireAuth, requireRole } from "../auth/auth.middleware";

export const auditRouter = Router();

auditRouter.use(requireAuth, requireRole("ADMIN", "AUDITOR"));

auditRouter.get("/", async (req, res, next) => {
  try {
    const query = z
      .object({
        action: z.string().optional(),
        entityType: z.string().optional(),
        userId: z.string().optional(),
      })
      .parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;
    if (query.userId) where.userId = query.userId;

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    res.json({
      logs: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.user?.name ?? null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: fromJsonField(log.metadata, null),
        ip: log.ip,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});
