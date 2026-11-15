"""Temporary, audited cross-user access for catalog maintenance."""
from contextlib import contextmanager
from uuid import uuid4


def identifier(name: str) -> str:
    return '`' + name.replace('`', '``') + '`'


@contextmanager
def break_glass(sql, reason: str, *, catalog: str = 'secondhand'):
    """Yield the audit id and revoke only its wildcard if acquisition or the body fails.

    sql(statement, args) must finish each statement before returning.
    A failed revoke propagates and leaves ended_at open for operator recovery.
    """
    governance = f'{identifier(catalog)}.`governance`'
    grant_id = 'bg_' + uuid4().hex
    try:
        sql(f'INSERT INTO {governance}.`break_glass` (id, principal, reason, started_at, ended_at) '
            'VALUES (:id, current_user(), :reason, current_timestamp(), NULL)', {'id': grant_id, 'reason': reason})
        sql(f"INSERT INTO {governance}.`principal_map` (principal, user_id, grant_id) VALUES (current_user(), '*', :id)",
            {'id': grant_id})
        yield grant_id
    finally:
        sql(f'DELETE FROM {governance}.`principal_map` WHERE grant_id = :id', {'id': grant_id})
        sql(f'UPDATE {governance}.`break_glass` SET ended_at = current_timestamp() '
            'WHERE id = :id AND principal = current_user()', {'id': grant_id})
