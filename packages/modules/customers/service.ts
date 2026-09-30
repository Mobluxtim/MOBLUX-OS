import { eq, desc } from 'drizzle-orm';
import { db } from '../../infrastructure/db.js';
import { customers, projects } from '../../../database/schema.js';
import { customerInput } from '../../contracts/index.js';
import { authorize, DomainError, type Actor } from '../identity/policy.js';
import { record } from '../audit/service.js';
export async function listCustomers(actor: Actor) { authorize(actor, 'customer.view'); return db.select().from(customers).orderBy(desc(customers.createdAt)); }
export async function customerDetail(actor: Actor, id: string) { authorize(actor, 'customer.view'); authorize(actor, 'project.view'); const customer = await db.query.customers.findFirst({ where: eq(customers.id, id) }); if (!customer) throw new DomainError(404, 'Customer not found.'); return { customer, projects: await db.select().from(projects).where(eq(projects.customerId, id)).orderBy(desc(projects.createdAt)) }; }
export async function createCustomer(actor: Actor, input: unknown) { authorize(actor, 'customer.manage'); const values = customerInput.parse(input); return db.transaction(async tx => { const [customer] = await tx.insert(customers).values(values).returning(); await record(tx, actor.id, 'customer.created', customer.id, null, { name: customer.name }); return customer; }); }
