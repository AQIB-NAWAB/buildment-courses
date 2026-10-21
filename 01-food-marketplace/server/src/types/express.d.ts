import type { AuthUser } from "../shared/types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      id?: string;
      rawBody?: Buffer;
    }
  }
}

export {};
