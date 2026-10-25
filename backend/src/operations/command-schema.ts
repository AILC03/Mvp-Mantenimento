import { z } from 'zod';
import type { Command } from '@real-ejecutivo/domain';

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9:._-]+$/);
const text = z.string().max(4000);
const short = z.string().max(150);
const amount = z.number().finite().nonnegative().max(1e9);
const integer = amount.int();
const record = z
  .record(id, z.enum(['good', 'fault']))
  .refine((v) => Object.keys(v).length <= 300);
const material = z
  .object({ id, productId: id, quantity: amount, unitCost: amount.optional() })
  .strict();
export const formSchema = z
  .object({
    busId: z.string().max(100),
    sourceRequestId: id.optional(),
    priority: z.enum(['Normal', 'Alta', 'Urgente']),
    reason: text,
    scheduledDate: z.string().max(10),
    odometer: z.string().max(16),
    services: z
      .array(
        z
          .object({
            id,
            catalogId: id,
            name: short,
            category: short,
            hours: amount,
            assignee: short,
            instructions: text,
            materials: z.array(material).max(300),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
const entry = z
  .object({
    quantity: amount,
    unitCost: amount,
    occurredOn: z.string().max(10),
    supplier: short,
    receiptReference: short,
  })
  .strict();
const vehicle = z
  .object({
    fleetNumber: z.string().min(1).max(30),
    type: z.enum(['bus', 'truck']),
    brand: z.string().max(80),
    model: z.string().max(80),
    plate: z.string().max(30),
    vin: z.string().max(17),
    year: z.number().int().nullable(),
    odometer: integer,
    note: text,
  })
  .strict();
const review = z
  .object({
    name: short,
    description: text,
    frequency: z.enum(['days', 'yearly', 'trip']),
    intervalDays: integer.nullable(),
    aspects: z
      .array(z.object({ id, text: z.string().max(300) }).strict())
      .max(300),
  })
  .strict();
const client = { id: id.optional(), clientId: id };
const commandSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('vehicle.save'), input: vehicle, ...client })
    .strict(),
  z
    .object({
      type: z.literal('product.save'),
      input: z
        .object({
          sku: z.string().max(40),
          name: short,
          description: text,
          unit: z.enum(['pza', 'L']),
        })
        .strict(),
      initial: entry,
      ...client,
    })
    .strict(),
  z.object({ type: z.literal('stock.add'), id, input: entry }).strict(),
  z
    .object({
      type: z.literal('service.save'),
      input: z
        .object({
          name: short,
          category: short,
          hours: amount,
          description: text,
          compatibleVehicleIds: z.array(id).max(1000),
          materials: z
            .array(z.object({ productId: id, quantity: amount }).strict())
            .max(300),
        })
        .strict(),
      ...client,
    })
    .strict(),
  z
    .object({ type: z.literal('review.save'), input: review, ...client })
    .strict(),
  z
    .object({
      type: z.literal('request.create'),
      input: z
        .object({
          busId: id,
          title: z.string().max(120),
          description: z.string().max(2000),
          odometer: z.string().max(16),
        })
        .strict(),
      clientId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal('request.reject'),
      id,
      reason: z.string().max(2000),
    })
    .strict(),
  z
    .object({
      type: z.literal('order.create'),
      form: formSchema,
      clientId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal('order.change'),
      id,
      action: z.enum(['start', 'pause', 'resume']),
      notes: text,
    })
    .strict(),
  z
    .object({
      type: z.literal('order.finish'),
      id,
      input: z
        .object({
          date: z.string().max(10),
          odometer: integer,
          performedServiceIds: z.array(id).max(100),
          unperformedReasons: z.record(id, text),
          notes: text,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('materials.confirm'),
      id,
      totals: z
        .array(
          z
            .object({ productId: id, delivered: amount, returned: amount })
            .strict(),
        )
        .max(300),
      notes: text,
    })
    .strict(),
  z
    .object({
      type: z.literal('caf.correct'),
      vehicleId: id,
      input: z
        .object({
          date: z.string().max(10),
          odometer: integer,
          reason: text,
          confirmed: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('review.record'),
      vehicleId: id,
      templateId: id,
      input: z
        .object({ date: z.string().max(10), answers: record, notes: text })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('damage.add'),
      vehicleId: id,
      input: z
        .object({
          kind: z.enum(['Golpe', 'Incidencia']),
          area: short,
          description: text,
          date: z.string().max(10),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('incident.resolve'),
      vehicleId: id,
      sourceId: id,
      notes: text,
      orderId: z.string().max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal('trip.start'),
      input: z
        .object({
          busId: id,
          departureDate: z.string().max(10),
          returnDate: z.string().max(10),
        })
        .strict(),
      clientId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal('trip.submit'),
      id,
      stage: z.enum(['pre', 'post']),
      answers: record,
      notes: z.string().max(2000),
      templateId: id.optional(),
    })
    .strict(),
  z
    .object({ type: z.literal('trip.close'), id, notes: z.string().max(2000) })
    .strict(),
  z.object({ type: z.literal('draft.save'), form: formSchema }).strict(),
]);
export const envelopeSchema = z
  .object({
    commandId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    command: commandSchema,
  })
  .strict();
export function parseEnvelope(body: unknown): {
  commandId: string;
  revision: number;
  command: Command;
} {
  return envelopeSchema.parse(body);
}
