export const costCategories=['PANEL','EDGE_MATERIAL','CUTTING','EDGE_SERVICE','HARDWARE','DRILLING','GROOVE','ROUTING','DOUBLING'] as const;
export type CostCategory=typeof costCategories[number];
export type CostUnit='m2'|'sheet'|'m'|'source_item'|'hole'|'roll'|'service';
export type PanelBasis='NET_M2'|'OPTIMIZED_M2'|'SHEETS';
export interface CostRate {key:string;category:CostCategory;unit:CostUnit;rate:string;}
export interface CostRules {currency:'RON'|'EUR'|'USD';panelBasis:PanelBasis;rates:CostRate[];reason:string;configuration?:CostConfiguration;}
export interface OperationPriceFamily {id:string;name:string;active:boolean;category:'DRILLING'|'GROOVE'|'ROUTING'|'EDGE_SERVICE';unit:'hole'|'m'|'m2';memberKeys:string[];rate:string|null;evidence:string;}
export interface CostConfiguration {
 version:1;
 glass:{materialMasterId:string;evidence:string}[];
 doubling:{finalMaterialMasterId:string;layerMaterialMasterId:string;finalThicknessMm:'36';layerThicknessMm:'18';evidence:string;layerSheets:string|null;sheetLengthMm:string|null;sheetWidthMm:string|null}[];
 edges:{materialMasterId:string;basis:'m'|'roll';rollLengthM:string|null;widthMm:string|null;type:string|null;evidence:string}[];
 cutting:{mode:'INTERNAL'|'EXTERNAL';externalUnit:'m'|'service';externalQuantity:string|null;evidence:string};
 families:OperationPriceFamily[];
 workstations:WorkstationCostPlaceholder[];
}
export interface WorkstationCostPlaceholder {name:string;purchaseCost:string|null;usefulLifeYears:string|null;productiveHoursPerYear:string|null;laborPerHour:string|null;energyPerHour:string|null;toolingPerHour:string|null;maintenancePerYear:string|null;allocatedOverheadPerYear:string|null;}
/** Contracts only: no catalog, supplier lookup, purchasing, or machine calculations in this increment. */
export interface HardwareCostIdentity {id:string;kind:'ITEM'|'KIT';sourceCodes:{namespace:string;code:string}[];components:{hardwareMasterId:string;quantity:string}[];}
export interface FutureCommercialPrice {hardwareMasterId:string;supplierProductId:string;currency:string;amount:string;validFrom:string;source:'SUPPLIER'|'HISTORICAL';}
export type FutureProjectCostDimension='ENGINEERING'|'DIRECT_LABOR'|'ASSEMBLY'|'INSTALLATION'|'TRANSPORT'|'EXTERNAL_SERVICE'|'ALLOCATED_OVERHEAD';
export interface FutureRemnantReference {inventoryItemId:string;materialMasterId:string;thicknessMm:string;lengthMm:string;widthMm:string;}
export interface CostOverride {baseRunId:string;requestId:string;payloadHash:string;lineKey:string;originalValue:string|null;originalExactValue:string|null;value:string;actor:string;timestamp:string;reason:string|null;}
export interface CostRuleVersion {id:string;projectId:string;sequence:number;rules:CostRules;createdAt:string;createdBy:string;}
export interface CostInputs {bomId:string|null;optimizationId:string|null;hardwareId:string|null;machiningId:string|null;}
export interface CostEvidence {reportId:string;path:string;sourceId?:string;sourceHash?:string;partId?:string|null;cabinetId?:string|null;page?:number;row?:number;}
export interface CostLine {
 key:string;category:CostCategory;label:string;unit:CostUnit;quantity:string|null;
 rate:string|null;exactSubtotal:string|null;subtotal:string|null;status:'COSTED'|'MISSING_RATE'|'MISSING_DATA'|'MISSING_COST_BASIS'|'MANUAL_OVERRIDE';reason:string|null;
 override?:CostOverride;configurationEvidence?:string[];consumption?:{layerMaterialMasterId:string;layerThicknessMm:string;layers:2;netAreaM2:string;finalAreaM2:string};
 evidence:CostEvidence[];referencePrices:{unitRaw:string|null;totalRaw:string|null;evidence:CostEvidence}[];
}
export interface CostResult {
 currency:CostRules['currency']|null;panelBasis:PanelBasis;lines:CostLine[];
 categories:{category:CostCategory;knownSubtotal:string|null;subtotal:string|null;missingLines:number}[];
 knownSubtotal:string|null;total:string|null;status:'COMPLETE'|'PARTIAL';coverageIssues:string[];warnings:string[];
 overrideEvent?:CostOverride;
 workstations?:{name:string;status:'INCOMPLETE / MISSING DATA'|'CONFIGURED / NOT CALCULATED';missing:string[]}[];
}
export interface CostRun {id:string;projectId:string;versionId:string;modelId:string;ruleVersionId:string;inputs:CostInputs;algorithmVersion:string;result:CostResult;createdAt:string;}
export interface CostState {
 rules:CostRuleVersion|null;history:CostRun[];selection:CostInputs;preview:CostResult;
 options:Record<keyof CostInputs,{id:string;label:string}[]>;
 canConfigure:boolean;canCalculate:boolean;canOverride:boolean;
 configurationTargets?:CostLine[];
 materialOptions?:{id:string;name:string;category:string;thickness:string}[];
}
