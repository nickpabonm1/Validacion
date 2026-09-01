import { Router } from "express";
import { CreateUserInputSchema, UpdateUserInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { createUser, deleteUser, listUsers, toUserDto, updateUser } from "./users.service";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/", requireRole("ADMIN", "AUDITOR"), async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users: users.map(toUserDto) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = CreateUserInputSchema.parse(req.body);
    const user = await createUser(input);
    await logAudit("CREATE", "User", user.id, auditContextFrom(req), { role: user.role });
    res.status(201).json({ user: toUserDto(user) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = UpdateUserInputSchema.parse(req.body);
    const user = await updateUser(req.params.id as string, input);
    await logAudit("UPDATE", "User", user.id, auditContextFrom(req), { fields: Object.keys(input) });
    res.json({ user: toUserDto(user) });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    await deleteUser(req.params.id as string);
    await logAudit("DELETE", "User", req.params.id as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
