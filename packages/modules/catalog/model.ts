// Automatic resolution creates source-evidenced internal masters, never manufacturing authorization.
// Suppliers, offers, prices and stock are separate future module concepts.
interface MasterIdentity { id: string; name: string; manufacturerReference: string | null; }
export interface PanelMaterial extends MasterIdentity { kind: 'PANEL'; thicknessMm: string | null; }
export interface EdgeMaterial extends MasterIdentity { kind: 'EDGE'; thicknessMm: string | null; bandWidthMm: string | null; }
export interface BarProfileMaterial extends MasterIdentity { kind: 'BAR'; verifiedProfileReference: string | null; }
export type MaterialMaster = PanelMaterial | EdgeMaterial | BarProfileMaterial;
