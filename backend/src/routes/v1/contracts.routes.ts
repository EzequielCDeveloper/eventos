import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as contractService from '../../services/contract.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Contract endpoints (UR-002.8, BR-012.6) mounted under `/api/v1/contracts`.
 *
 * GET /:id — contract detail for client/provider/admin.
 * PUT /:id/confirm — bilateral in-app confirmation of the physical firma;
 * the reservation advances to `contrato_confirmado` once BOTH parties confirm.
 */
export const contractsRouter: Router = Router();

const contractParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const confirmBodySchema = z
  .object({
    party: z.enum(['cliente', 'proveedor']),
  })
  .strict();

/** GET /contracts/:id — contract with bilateral confirmation state. */
contractsRouter.get(
  '/:id',
  requireAuth(),
  validate({ params: contractParamsSchema }),
  asyncHandler(async (req, res) => {
    const contract = await contractService.getContract(Number(req.params.id), req.user!);
    res.json({ data: contract });
  }),
);

/** PUT /contracts/:id/confirm — one party confirms the in-person firma. */
contractsRouter.put(
  '/:id/confirm',
  requireAuth(),
  validate({ params: contractParamsSchema, body: confirmBodySchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof confirmBodySchema>;
    const result = await contractService.confirmContract(Number(req.params.id), req.user!, body.party);
    res.json({ data: result });
  }),
);