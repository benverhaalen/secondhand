import type { FieldRow } from './table.ts';

export type TextLine = {line:string; confidence:number};
export type PartRead = {field:string; value:string|number; source:'label'; confidence:number};

function valueFor(text: string, row: FieldRow, slack: number): string|number|undefined {
  if(row.type==='text') {
    const value=text.replace(/\((?:R|TM)\)|[®™]/gi,'')
      .replace(/\b(?:CPU|Processor)\b/gi,'')
      .replace(/(?:\s*@?\s*\d+(?:\.\d+)?\s*[GM]Hz)+\s*$/i,'')
      .replace(/\s+/g,' ').trim();
    return value || undefined;
  }
  if(row.unit==='GB') {
    const of=text.toLowerCase().lastIndexOf(' of ');
    const rest=of<0 ? text : text.slice(of+4);
    const match=rest.match(/\b(\d+(?:\.\d+)?)\s*(GB|TB)\b/i);
    if(!match)return undefined;
    const reading=Number(match[1])*(match[2].toUpperCase()==='TB'?1000:1);
    let size:number|undefined,nearest=Infinity;
    for(const attempt of [reading,reading*1.073741824]) {
      for(const value of row.values ?? []) {
        if(typeof value!=='number')continue;
        const ratio=Math.max(attempt,value)/Math.min(attempt,value);
        if(ratio<nearest) {size=value;nearest=ratio;}
      }
    }
    return nearest<=1+slack ? size : undefined;
  }
  if(row.type==='number' && row.unit==='W') {
    const match=text.match(/\b(\d+(?:\.\d+)?)\s*W\b/i);
    return match ? Number(match[1]) : undefined;
  }
  return undefined;
}

export function readParts(lines: TextLine[], rows: FieldRow[], slack: number): PartRead[] {
  const reads:PartRead[]=[];
  for(const row of rows) {
    for(const {line,confidence} of lines) {
      const text=line.replace(/\s+/g,' ').trim();
      if(/\b(?:Device name|Product ID)\b/i.test(text))continue;
      const label=row.labels?.find(label=>text.startsWith(label) && (text.length===label.length || /^[\s:]/.test(text.slice(label.length))));
      if(label===undefined)continue;
      const value=valueFor(text.slice(label.length).replace(/^[:\s]+/,''),row,slack);
      if(value!==undefined)reads.push({field:`part.${row.field}`,value,source:'label',confidence});
      break;
    }
  }
  return reads;
}
