import { select, targets, studioStep, type State } from './select.ts';
import { fieldState, viewsFor, type Resolution } from './fields.ts';
import { completeness, type Completeness } from './complete.ts';
import { bound, compare, linked, type AskKind, type FieldRow, type Target } from './table.ts';
import type { ParamStore } from '../param/param.ts';
import { SITES } from '../../../../spec/sites.mjs';
export type { State, Fact } from './select.ts';

export type Question = {
  id: string;
  field: string;
  fields?: string[];
  kind: AskKind|'shot';
  options: {value: unknown; proposed: boolean; label?: string; rests_on?: string[]}[];
  other: boolean;
  max_length?: number;
  unit?: string;
  units?: string[];
  parts?: string[];
  shot?: {step: string; reason: 'retake'|'add'; for?:'studio'; zone?:string; flaw_kind?:string};
  why: 'required'|'confirm'|'value'|'only_you_know';
  required_by: Target[];
  unlocks: {required: number; ready_after: Target[]};
  words: string;
  answer: {method: 'PATCH'|'POST'; path: string};
};
type Resolved = {row: FieldRow; resolution: Resolution};
type Candidate = {question: Question; rows: FieldRow[]; rank?: number};
type ShotGroup = {shot: NonNullable<Resolution['shot']>; rows: FieldRow[]};

function siteFieldRows(state: State, captureRows: FieldRow[]): FieldRow[] {
  const rows: FieldRow[] = [];
  for(const row of state.site_rows ?? []) {
    if(!state.sites.includes(row.site) || captureRows.some(capture=>capture.field===row.field))continue;
    const existing=rows.find(candidate=>candidate.field===row.field);
    if(existing) {
      const sites=(row.required ? existing.required : existing.recommended) as Target[];
      if(!sites.includes(row.site))sites.push(row.site);
      continue;
    }
    rows.push({field:row.field,type:row.allowed ? 'enum':'text',...(row.allowed ? {values:[...row.allowed]}:{}),
      ways:[{way:'asked'}],confirm:'always',required:row.required?[row.site]:[],recommended:row.required?[]:[row.site],
      ask:{kind:row.allowed?'pick_one':'text',words:row.name}});
  }
  return rows;
}

function usedByLinkedSite(row: FieldRow, state: State): boolean {
  return linked(targets(state),row.required).length > 0 || linked(targets(state),row.recommended).length > 0;
}

function invalidForRequiredSite(row: FieldRow, complete: Completeness, state: State): boolean {
  return linked(targets(state),row.required).some(site => complete[site]!.missing.some(field => field.field === row.field));
}

function fieldQuestions(resolved: Resolved[], state: State, complete: Completeness, shooting: boolean, siteRows: FieldRow[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const {row,resolution} of resolved) {
    if (row.field === 'condition' && state.purpose === 'find') continue;
    if (shooting && row.field !== 'type' && row.field !== 'lot_count') continue;
    if (resolution.shot || !row.ask || resolution.state === 'refused') continue;
    const invalidKnown = resolution.state === 'known' && invalidForRequiredSite(row,complete,state);
    if (!invalidKnown && resolution.state !== 'proposed' && resolution.state !== 'missing') continue;
    const hasAsked = row.ways.some(way => way.way === 'asked');
    if (!invalidKnown && resolution.state === 'missing' && row.field !== 'type' && !hasAsked) continue;
    const candidatesForField = state.candidates?.[row.field];
    const choices = candidatesForField?.length ? candidatesForField : row.values ?? [];
    const values: unknown[] = [...choices];
    const askedOnly = row.ways.every(way => way.way === 'asked');
    const siteRow = siteRows.includes(row) ? state.site_rows?.find(candidate=>candidate.field===row.field && state.sites.includes(candidate.site)) : undefined;
    let proposed = !invalidKnown && resolution.state === 'proposed' && !askedOnly ? resolution.fact?.value : undefined;
    if(siteRow)proposed=siteRow.value!==undefined && (!siteRow.allowed || siteRow.allowed.includes(siteRow.value)) ? siteRow.value : undefined;
    if (row.field === 'type' && proposed !== undefined) {
      const index = values.indexOf(proposed);
      if (index >= 0) values.splice(index,1);
      values.unshift(proposed);
    } else if (proposed !== undefined && !values.some(value => JSON.stringify(value) === JSON.stringify(proposed))) {
      values.unshift(proposed);
    }
    let kind = row.ask.kind;
    if (row.type === 'text') {
      const hasOptions = choices.length > 0;
      kind = hasOptions ? 'pick_one' : 'text';
    }
    let options: Question['options'] = values.map(value => ({value,proposed:proposed !== undefined && JSON.stringify(value) === JSON.stringify(proposed)}));
    const variants=resolution.reason==='variants'?state.variants!.dimensions:undefined;
    if(variants) {kind='pick_one';options=variants.map(variant=>({value:variant.value,label:variant.label,proposed:false}));}
    const required_by = linked(targets(state),row.required);
    const why = siteRows.includes(row) ? required_by.length ? 'required' : 'value' :
      invalidKnown ? 'required' : resolution.state === 'proposed' ? 'confirm' : required_by.length ? 'required' : askedOnly ? 'only_you_know' : 'value';
    const question: Question = {
      id:`q_${state.capture_id}_${row.field}`,
      field:row.field,
      kind,
      options,
      ...(siteRow?.max_length!==undefined ? {max_length:siteRow.max_length} : {}),
      other:!!variants || row.type === 'text' || row.field === 'type',
      ...(row.unit ? {unit:row.unit} : {}),
      ...(row.ask.units ? {units:[...row.ask.units]} : {}),
      ...(row.ask.parts ? {parts:[...row.ask.parts]} : {}),
      why,
      required_by,
      unlocks:{required:0,ready_after:[]},
      words:row.ask.words,
      answer:{method:'PATCH',path:`/v1/captures/${state.capture_id}`},
    };
    candidates.push({question,rows:[row]});
  }
  return candidates;
}

function shotQuestions(resolved: Resolved[], state: State, keys: string[], shooting: boolean): {candidates: Candidate[]; shots: Record<string,ShotGroup>} {
  const shots: Record<string,ShotGroup> = {};
  for (const {row,resolution} of resolved) {
    if (row.field === 'condition' && state.purpose === 'find') continue;
    const shot = resolution.shot;
    if (!shot) continue;
    if (shooting && (shot.reason !== 'retake' || !state.kept.includes(shot.step))) continue;
    const group = shots[shot.step] ?? {shot,rows:[]};
    group.rows.push(row);
    shots[shot.step] = group;
  }
  const candidates: Candidate[] = [];
  for (const step of Object.keys(shots).sort(compare)) {
    const {shot,rows} = shots[step];
    rows.sort((a,b) => compare(a.field,b.field));
    const coverage = resolved.filter(({row}) => row.ways.some(way => {
      const fromView = ['seen','label','measured'].includes(way.way);
      const available = way.way !== 'measured' || state.has_lidar;
      return fromView && available && way.view && viewsFor(way.view,keys).includes(step);
    }));
    const question: Question = {
      id:`q_${state.capture_id}_${step}`,
      field:step,
      fields:coverage.map(({row}) => row.field),
      kind:'shot',
      options:[],
      other:false,
      shot,
      why:rows.some(row => linked(targets(state),row.required).length) ? 'required' : 'value',
      required_by:targets(state).filter(site => rows.some(row => linked([site],row.required).length)),
      unlocks:{required:0,ready_after:[]},
      words:shot.reason === 'retake' ? `Retake the ${step.replaceAll('_',' ')}` : `One more: the ${step.replaceAll('_',' ')}`,
      answer:{method:'POST',path:`/v1/captures/${state.capture_id}/photos`},
    };
    candidates.push({rows,question});
  }
  return {candidates,shots};
}

function addUnlocks(candidates: Candidate[], resolved: Resolved[], rows: FieldRow[], state: State, complete: Completeness, family: ReturnType<typeof select>['family'], params: ParamStore): void {
  for (const {question,rows:answeredRows} of candidates) {
    question.unlocks.required = (question.shot?.for==='studio'?1:0) + answeredRows.reduce((count,row) => count + linked(targets(state),row.required).length,0);
    const refused = state.refused.filter(field => !answeredRows.some(row => row.field === field));
    const hypothetical = {...state,facts:{...state.facts},kept:[...state.kept],refused};
    if(question.shot)hypothetical.kept.push(question.shot.step);
    for (const row of answeredRows) {
      const resolution = resolved.find(entry => entry.row.field === row.field)!.resolution;
      const current = resolution.fact?.value;
      const invalidKnown = resolution.state === 'known' && invalidForRequiredSite(row,complete,state);
      const value = state.studio?.requested && row.type==='dimensions' ? Object.fromEntries((row.ask?.parts ?? []).map(part=>[part,0])) : invalidKnown ? row.values?.[0] ?? '' : current ?? row.values?.[0] ?? '';
      hypothetical.facts[row.field] = {value,source:'you_said',confidence:1};
      if (row.field === 'type') hypothetical.type = family;
    }
    const after = completeness(rows,hypothetical,params);
    question.unlocks.ready_after = targets(state).filter(site => !complete[site]!.ready && after[site]!.ready);
  }
}

function orderQuestions(candidates: Candidate[], state: State, params: ParamStore): void {
  const first = ({question,rows}: Candidate) => question.field === 'type' ? 0 : question.field === 'lot_count' ? 1 : rows.some(row=>row.shapes) ? 2 : 3;
  const rank = (candidate: Candidate) => candidate.rank ?? Math.min(...candidate.rows.map(row=>row.rank ?? Infinity));
  const entropy = (field: string) => {
    const scores=Object.values(state.candidate_detail?.[field] ?? {}).map(option=>option.c).filter(score=>score>0);
    const sum=scores.reduce((total,score)=>total+score,0);
    const bits=scores.reduce((bits,score)=>{const p=score/sum;return bits-p*Math.log2(p);},0);
    return Math.round(bits*1e9)/1e9;
  };
  const recommended = (rows: FieldRow[]) => rows.reduce((count,row) => count + linked(targets(state),row.recommended).length,0);
  const effort = (question: Question) => bound(params,`capture_effort_${question.kind}`);
  candidates.sort((a,b) => {
    const priority = first(a) - first(b);
    const information = entropy(b.question.field) - entropy(a.question.field);
    const required = b.question.unlocks.required - a.question.unlocks.required;
    const ready = b.question.unlocks.ready_after.length - a.question.unlocks.ready_after.length;
    const recommendation = recommended(b.rows) - recommended(a.rows);
    const ranked = rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : 0;
    const cost = effort(a.question) - effort(b.question);
    return priority || information || required || ready || recommendation || ranked || cost || compare(a.question.field,b.question.field);
  });
}

function capQuestions(candidates: Candidate[], rows: FieldRow[], state: State, params: ParamStore): Question[] {
  const consumed = rows.filter(row => {
    const optional = linked(targets(state),row.required).length === 0;
    const answered = state.facts[row.field]?.source === 'you_said' || state.facts[row.field]?.confirmed === true || state.refused.includes(row.field);
    return optional && answered;
  }).length;
  let remaining = Math.max(0,bound(params,'capture_question_cap') - consumed);
  const questions: Question[] = [];
  for (const {question} of candidates) {
    if (question.unlocks.required > 0) {
      questions.push(question);
    } else if (remaining > 0) {
      questions.push(question);
      remaining -= 1;
    }
  }
  return questions;
}

export function plan(state: State, params: ParamStore) {
  if (targets(state).length === 0) state = {...state,sites:[...SITES] as State['sites']};
  const selected = select(state,params);
  const keys = selected.process.map(step => step.key);
  const siteRows=siteFieldRows(state,selected.rows);
  const rows = [...selected.rows,...siteRows].filter(row => usedByLinkedSite(row,state)).sort((a,b)=>compare(a.field,b.field));
  const resolved = rows.map(row => ({row,resolution:fieldState(row,state,keys,params)}));
  const complete = completeness(rows,state,params);
  const fields = resolved.map(({row,resolution}) => ({
    field:row.field,
    state:resolution.state,
    value:resolution.fact?.value ?? null,
    source:resolution.fact?.source ?? null,
    ...(resolution.auto_accepted ? {auto_accepted:true as const} : {}),
    ...(resolution.fact?.note?{note:resolution.fact.note}:{}),
    required_by:linked(targets(state),row.required),
    recommended_by:linked(targets(state),row.recommended),
  }));
  const shooting = keys.some(key => !state.kept.includes(key));
  const candidates = fieldQuestions(resolved,state,complete,shooting,siteRows);
  const {candidates:shotsToAsk} = shotQuestions(resolved,state,keys,shooting);
  candidates.push(...shotsToAsk);
  const read=selected.read;
  if(read && !shooting && !keys.includes(read.step) && state.lookups!=='running' &&
    !state.kept.includes(read.step) && !state.refused.includes(read.step) &&
    (selected.after ?? []).every(field=>['known','refused'].includes(fieldState(selected.rows.find(row=>row.field===field)!,state,keys,params).state))) {
    const parts=resolved.filter(({row,resolution})=>row.field.startsWith('part.') && row.ways.some(way=>way.way==='asked') && resolution.state!=='known');
    if(parts.length)candidates.push({rows:parts.map(({row})=>row),rank:0,question:{
      id:`q_${state.capture_id}_${read.step}`,field:read.step,kind:'shot',options:[],other:false,
      shot:{step:read.step,reason:'add'},why:'value',required_by:[],unlocks:{required:0,ready_after:[]},words:read.words,
      answer:{method:'POST',path:`/v1/captures/${state.capture_id}/photos`},
    }});
  }
  if(state.studio?.requested && !shooting)for(const ask of state.studio.asks) {
    const step=studioStep(ask);
    if(ask.type==='measure' || state.kept.includes(step) || candidates.some(candidate=>candidate.question.shot?.for==='studio' && candidate.question.shot.step===step))continue;
    candidates.push({rows:[],question:{
      id:`q_${state.capture_id}_studio_${step}`,field:step,kind:'shot',options:[],other:false,
      shot:{step,reason:'add',for:'studio',...(ask.zone?{zone:ask.zone}:{}),...(ask.kind?{flaw_kind:ask.kind}:{})},
      why:'required',required_by:['studio'],unlocks:{required:0,ready_after:[]},words:ask.text,
      answer:{method:'POST',path:`/v1/captures/${state.capture_id}/photos`},
    }});
  }
  addUnlocks(candidates,resolved,rows,state,complete,selected.family,params);
  for(const {question} of candidates)for(const option of question.options) {
    const details=state.candidate_detail;
    const field=details && Object.hasOwn(details,question.field) ? details[question.field] : undefined;
    const key=String(option.value);
    const detail=field && Object.hasOwn(field,key) ? field[key] : undefined;
    if(Array.isArray(detail?.rests_on) && detail.rests_on.length)option.rests_on=[...detail.rests_on];
  }
  orderQuestions(candidates,state,params);
  const questions = capQuestions(candidates,rows,state,params);
  const process = selected.process.map(step => ({
    ...step,
    state:questions.some(question=>question.shot?.step===step.key && question.shot.reason==='retake') ? 'retake' as const : state.kept.includes(step.key) ? 'kept' as const : 'pending' as const,
  }));
  const waiting = fields.some(field => field.state === 'waiting' && field.required_by.length > 0);
  const status = shooting ? 'shooting' as const : questions.length || waiting ? 'asking' as const : 'done' as const;
  const {rows:_rows,...selection} = selected;
  return {...selection,process,fields,questions,complete,status};
}
