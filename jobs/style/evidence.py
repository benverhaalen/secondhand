"""Finite numbers with frozen calculation inputs (product.md §6 proof layer)."""
import hashlib
import json
import math
from datetime import date, datetime


class RangeError(ValueError):
    pass


def money(value, field, *, positive=False):
    # IEEE-754's safe integer ceiling is a fixed cross-language representation limit.
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value!=math.floor(value) or value < (1 if positive else 0) or value>2**53-1:
        raise RangeError(field+' must be '+('positive' if positive else 'nonnegative')+' safe integer cents')
    return int(value)


def _json(value):
    if isinstance(value,(datetime,date)):
        return value.isoformat()
    raise TypeError(type(value).__name__)


def publish(numbers, basis, as_of, params, *, metric, basis_level='person'):
    if not basis:
        raise ValueError('no_basis')
    if any(not math.isfinite(v) for v in numbers.values()):
        raise ValueError('shown number must be finite')
    basis=sorted(basis,key=lambda b:b['id'])
    frozen=dict(metric=metric,basis=basis,computed_at=as_of,param_versions=params['versions'],
                param_values=params['values'],values=numbers,code_version='style-audit-v1',table_versions=[],model_version=None,
                definition_version='spec/engines/recommendation-and-style.md',basis_level=basis_level)
    encoded=json.dumps(frozen,sort_keys=True,default=_json,allow_nan=False)
    frozen=json.loads(encoded)
    digest=hashlib.sha256(encoded.encode()).hexdigest()
    citation=dict(frozen,id='cit_'+digest,basis_hash=digest,basis_ids=[b['id'] for b in basis])
    return dict(citation=citation, basis_level=basis_level,
                guarded={name:dict(value=value,state='shown',basis_count=len(basis),as_of=_json(as_of) if isinstance(as_of,(datetime,date)) else as_of,
                                   citation_id=citation['id'],basis_level=basis_level) for name,value in numbers.items()})
