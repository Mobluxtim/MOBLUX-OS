export const capabilities = ['customer.view', 'customer.manage', 'project.view', 'presentation.edit', 'presentation.preview', 'quote.view', 'quote.edit', 'quote.preview', 'project.create', 'project.version.create', 'project.import', 'project.files.download', 'project.cost.view', 'cost.configure', 'cost.calculate', 'cost.override', 'audit.view', 'library.view', 'library.import', 'library.raw.view', 'library.match', 'library.activate'] as const;
export type Capability = typeof capabilities[number];
export interface Actor { id: string; kind: 'staff' | 'customer'; grants: Set<string>; denies: Set<string>; }
export class DomainError extends Error { constructor(public status: number, message: string) { super(message); } }
export function authorize(actor: Actor, capability: Capability) {
  // This staff-only slice has no customer portal. Customer actors are denied entirely.
  if (actor.kind !== 'staff' || actor.denies.has(capability) || !actor.grants.has(capability)) throw new DomainError(403, 'You do not have permission for this action.');
}
