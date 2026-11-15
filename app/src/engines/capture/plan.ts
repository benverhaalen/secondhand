import { select, type State } from './select.ts';
import { fieldState, viewsFor, type Resolution } from './fields.ts';
import { completeness, type Completeness } from './complete.ts';
import { bound, compare, linked, type AskKind, type FieldRow, type Site } from './table.ts';
import type { ParamStore } from '../param/param.ts';
export type { State, Fact } from './select.ts';

export type Question = {
  id: string;
  field: string;
  fields?: string[];
  kind: AskKind|'shot';
  options: {value: unknown; proposed: boolean}[];
  other: boolean;
  unit?: string;
  units?: string[];
  parts?: string[];
  shot?: {step: string; reason: 'retake'|'add'};
  why: 'required'|'confirm'|'value'|'only_you_know';
  required_by: Site[];
  unlocks: {required: number; ready_after: Site[]};
  words: string;
  answer: {method: 'PATCH'|'POST'; path: string};
};
type Resolved = {row: FieldRow; resolution: Resolution};
type Candidate = {question: Question; rows: FieldRow[]};
type ShotGroup = {shot: NonNullable<Resolution['shot']>; rows: FieldRow[]};

function usedByLinkedSite(row: FieldRow, state: State): boolean {
  return linked(state.sites,row.required).length > 0 || linked(state.sites,row.recommended).length > 0;
}

function invalidForRequiredSite(row: FieldRow, complete: Completeness, state: State): boolean {
  return linked(state.sites,row.required).some(site => complete[site]!.missing.some(field => field.field === row.field));
}

function fieldQuestions(resolved: Resolved[], state: State, complete: Completeness, shooting: boolean): Candidate[] {
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
    const proposed = !invalidKnown && resolution.state === 'proposed' && !askedOnly ? resolution.fact?.value : undefined;
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
    const options = values.map(value => ({value,proposed:proposed !== undefined && JSON.stringify(value) === JSON.stringify(proposed)}));
    const required_by = linked(state.sites,row.required);
    const why = invalidKnown ? 'required' : resolution.state === 'proposed' ? 'confirm' : required_by.length ? 'required' : askedOnly ? 'only_you_know' : 'value';
    const question: Question = {
      id:`q_${state.capture_id}_${row.field}`,
      field:row.field,
      kind,
      options,
      other:row.type === 'text' || row.field === 'type',
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
      why:rows.some(row => linked(state.sites,row.required).length) ? 'required' : 'value',
      required_by:state.sites.filter(site => rows.some(row => linked([site],row.required).length)),
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
    question.unlocks.required = answeredRows.reduce((count,row) => count + linked(state.sites,row.required).length,0);
    const refused = state.refused.filter(field => !answeredRows.some(row => row.field === field));
    const hypothetical = {...state,facts:{...state.facts},refused};
    for (const row of answeredRows) {
      const resolution = resolved.find(entry => entry.row.field === row.field)!.resolution;
      const current = resolution.fact?.value;
      const invalidKnown = resolution.state === 'known' && invalidForRequiredSite(row,complete,state);
      const value = invalidKnown ? row.values?.[0] ?? '' : current ?? row.values?.[0] ?? '';
      hypothetical.facts[row.field] = {value,source:'you_said',confidence:1};
      if (row.field === 'type') hypothetical.type = family;
    }
    const after = completeness(rows,hypothetical,params);
    question.unlocks.ready_after = state.sites.filter(site => !complete[site]!.ready && after[site]!.ready);
  }
}

function orderQuestions(candidates: Candidate[], state: State, params: ParamStore): void {
  const first = (question: Question) => question.field === 'type' ? 0 : question.field === 'lot_count' ? 1 : 2;
  const recommended = (rows: FieldRow[]) => rows.reduce((count,row) => count + linked(state.sites,row.recommended).length,0);
  const effort = (question: Question) => bound(params,`capture_effort_${question.kind}`);
  candidates.sort((a,b) => {
    const priority = first(a.question) - first(b.question);
    const required = b.question.unlocks.required - a.question.unlocks.required;
    const ready = b.question.unlocks.ready_after.length - a.question.unlocks.ready_after.length;
    const recommendation = recommended(b.rows) - recommended(a.rows);
    const cost = effort(a.question) - effort(b.question);
    return priority || required || ready || recommendation || cost || compare(a.question.field,b.question.field);
  });
}

function capQuestions(candidates: Candidate[], rows: FieldRow[], state: State, params: ParamStore): Question[] {
  const consumed = rows.filter(row => {
    const optional = linked(state.sites,row.required).length === 0;
    const answered = state.facts[row.field]?.source === 'you_said' || state.refused.includes(row.field);
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
  const selected = select(state,params);
  const keys = selected.process.map(step => step.key);
  const rows = selected.rows.filter(row => usedByLinkedSite(row,state));
  const resolved = rows.map(row => ({row,resolution:fieldState(row,state,keys,params)}));
  const complete = completeness(rows,state,params);
  const fields = resolved.map(({row,resolution}) => ({
    field:row.field,
    state:resolution.state,
    value:resolution.fact?.value ?? null,
    source:resolution.fact?.source ?? null,
    required_by:linked(state.sites,row.required),
    recommended_by:linked(state.sites,row.recommended),
  }));
  const shooting = keys.some(key => !state.kept.includes(key));
  const candidates = fieldQuestions(resolved,state,complete,shooting);
  const {candidates:shotsToAsk,shots} = shotQuestions(resolved,state,keys,shooting);
  candidates.push(...shotsToAsk);
  addUnlocks(candidates,resolved,rows,state,complete,selected.family,params);
  orderQuestions(candidates,state,params);
  const questions = capQuestions(candidates,rows,state,params);
  const process = selected.process.map(step => ({
    ...step,
    state:shots[step.key]?.shot.reason === 'retake' ? 'retake' as const : state.kept.includes(step.key) ? 'kept' as const : 'pending' as const,
  }));
  const status = shooting ? 'shooting' as const : questions.length ? 'asking' as const : 'done' as const;
  const {rows:_rows,...selection} = selected;
  return {...selection,process,fields,questions,complete,status};
}
