import { Router } from "express";
import { CreateUserInputSchema, UpdateUserInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { buildClientScope } from "../clients/client-scope";
import { createUser, deleteUser, listUsers, toUserDto, updateUser } from "./users.service";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const users = await listUsers(scope);
    res.json({ users: users.map(toUserDto) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = CreateUserInputSchema.parse(req.body);
    const user = await createUser(input, scope);
    await logAudit("CREATE", "User", user.id, auditContextFrom(req), { role: user.role });
    res.status(201).json({ user: toUserDto(user) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = UpdateUserInputSchema.parse(req.body);
    const user = await updateUser(req.params.id as string, input, scope);
    await logAudit("UPDATE", "User", user.id, auditContextFrom(req), { fields: Object.keys(input) });
    res.json({ user: toUserDto(user) });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    await deleteUser(req.params.id as string, scope);
    await logAudit("DELETE", "User", req.params.id as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
