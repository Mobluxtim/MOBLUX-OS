export const capabilities = ['customer.view', 'customer.manage', 'project.view', 'project.create', 'project.version.create', 'project.import', 'project.files.download', 'project.cost.view', 'audit.view', 'library.view', 'library.import', 'library.raw.view', 'library.match'] as const;
export type Capability = typeof capabilities[number];
export interface Actor { id: string; kind: 'staff' | 'customer'; grants: Set<string>; denies: Set<string>; }
export class DomainError extends Error { constructor(public status: number, message: string) { super(message); } }
export function authorize(actor: Actor, capability: Capability) {
  // This staff-only slice has no customer portal. Customer actors are denied entirely.
  if (actor.kind !== 'staff' || actor.denies.has(capability) || !actor.grants.has(capability)) throw new DomainError(403, 'You do not have permission for this action.');
}
