import { z } from "zod";
import { ORDER_STATUSES } from "../../shared/types.js";

export const updateOrderStatusSchema = z.object({
  status: z.enum(["packed", "dispatched"]),
  currentStatus: z.enum(ORDER_STATUSES).optional()
});
