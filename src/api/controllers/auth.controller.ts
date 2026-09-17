import type { Request, Response } from 'express';
export async function discordCallback(_req: Request, res: Response) {
  return res.status(410).json({ success: false, error: 'Endpoint OAuth obsolète. Utilisez /api/auth/callback.', code: 'AUTH_CONTROLLER_DEPRECATED' });
}
