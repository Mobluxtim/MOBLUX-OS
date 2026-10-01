export const costCategories=['PANEL','EDGE_MATERIAL','CUTTING','EDGE_SERVICE','HARDWARE','DRILLING','GROOVE','ROUTING'] as const;
export type CostCategory=typeof costCategories[number];
export type CostUnit='m2'|'sheet'|'m'|'source_item'|'hole';
export type PanelBasis='NET_M2'|'OPTIMIZED_M2'|'SHEETS';
export interface CostRate {key:string;category:CostCategory;unit:CostUnit;rate:string;}
export interface CostRules {currency:'RON'|'EUR'|'USD';panelBasis:PanelBasis;rates:CostRate[];reason:string;}
export interface CostRuleVersion {id:string;projectId:string;sequence:number;rules:CostRules;createdAt:string;createdBy:string;}
export interface CostInputs {bomId:string|null;optimizationId:string|null;hardwareId:string|null;machiningId:string|null;}
export interface CostEvidence {reportId:string;path:string;sourceId?:string;sourceHash?:string;partId?:string|null;cabinetId?:string|null;page?:number;row?:number;}
export interface CostLine {
 key:string;category:CostCategory;label:string;unit:CostUnit;quantity:string|null;
 rate:string|null;exactSubtotal:string|null;subtotal:string|null;status:'COSTED'|'MISSING_RATE'|'MISSING_DATA';reason:string|null;
 evidence:CostEvidence[];referencePrices:{unitRaw:string|null;totalRaw:string|null;evidence:CostEvidence}[];
}
export interface CostResult {
 currency:CostRules['currency']|null;panelBasis:PanelBasis;lines:CostLine[];
 categories:{category:CostCategory;knownSubtotal:string|null;subtotal:string|null;missingLines:number}[];
 knownSubtotal:string|null;total:string|null;status:'COMPLETE'|'PARTIAL';coverageIssues:string[];warnings:string[];
}
export interface CostRun {id:string;projectId:string;versionId:string;modelId:string;ruleVersionId:string;inputs:CostInputs;algorithmVersion:string;result:CostResult;createdAt:string;}
export interface CostState {
 rules:CostRuleVersion|null;history:CostRun[];selection:CostInputs;preview:CostResult;
 options:Record<keyof CostInputs,{id:string;label:string}[]>;
 canConfigure:boolean;canCalculate:boolean;
}
