export interface MachiningEvidence { page:number; row:number; }
export interface DrawingText extends MachiningEvidence { text:string; pdfX:number; pdfY:number; }
export interface DrillingOperation {
  sourceType:'Gaurire'; label:string; diameterMm:string; depthRaw:string; depthMm:string|null; count:number;
  face:null; location:MachiningEvidence;
  coordinates:(DrawingText & {first:string;second:string;face:null})[];
}
export interface GrooveOperation {
  sourceType:string; face:string; x:string; y:string; widthMm:string; lengthMm:string; depthMm:string;
  raw:string[]; location:MachiningEvidence;
}
export interface MachiningTotals { drillingGroups:number; drawingDrillCount:number; quantityExtendedDrillCount:number; grooveOperations:number; grooveLengthMm:number; quantityExtendedGrooveLengthMm:number; }
export interface MachiningPart {
  cabinetLabel:string; sourceNumber:string; name:string; material:string; first:string; second:string; thickness:string; quantity:number;
  drawingReference:string|null; pages:number[]; header:string[];
  drilling:DrillingOperation[]; grooves:GrooveOperation[]; diagramEvidence:DrawingText[];
  partId:string|null; cabinetId:string|null; linkStatus:'LINKED'|'AMBIGUOUS'|'UNMAPPED';
  csvEvidence:{sourceId:string;reportId:string;row:number;line:number}|null;
  issues:string[]; totals:MachiningTotals;
}
export interface MachiningResult {
  projectLabel:string; sourcePages:number; parts:MachiningPart[];
  projectOperations:{sourceType:string;sourceLabel:string;lengthM:string;location:MachiningEvidence}[];
  cabinets:{sourceName:string;cabinetId:string|null;partIndexes:number[];totals:MachiningTotals}[];
  totals:MachiningTotals; linkedParts:number; unresolvedParts:number; issues:string[];
}
export interface MachiningReport {
 id:string;modelId:string;versionId:string;sourceId:string;sourceHash:string;parserVersion:string;
 status:'IMPORTED'|'FAILED'|'UNSUPPORTED';result:MachiningResult|null;finding:string|null;createdAt:string;
}
