"""Frozen input and parameter provenance for identity calculations.

Offer citations carry source ids, not an invented source URL. Consumers must
follow these ids to comp/retail evidence before publishing outside the job.
"""
import json
from copy import deepcopy
from hashlib import sha256


def citation(metric, inputs, resolved, *, sources=(), at=None, allowed=True):
    basis_hash = sha256(json.dumps(inputs, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    sources = list(sources) or ['input:' + basis_hash]
    body = {'metric': metric, 'definition_version': 'spec/engines/identity.md#3-the-calculation',
            'code_version': 'identity-audit-1', 'param_versions': dict(resolved['versions']),
            'model_version': None, 'table_versions': [], 'filters': {},
            'basis_ids': sorted(sources), 'basis_hash': basis_hash}
    ident = sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
    return {**body, 'id': 'cit_' + ident, 'computed_at': at, 'sources': sorted(sources),
            'input_snapshot': deepcopy(inputs),
            'guard': {'allowed': allowed, 'state': 'shown' if allowed else 'hidden',
                      'hide_reason': None if allowed else 'source_gap'}}
