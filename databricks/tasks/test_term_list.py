"""Offline term-list contracts; execute the production aggregation with SQLite array adapters."""
import json
import re
import sqlite3
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

from tasks import term_list

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def db():
    connection = sqlite3.connect(':memory:')
    connection.row_factory = sqlite3.Row
    connection.execute('CREATE TABLE comp (source TEXT, kind TEXT, brand TEXT, title TEXT, price_cents INT, description TEXT)')
    connection.execute('CREATE TABLE param (name TEXT, scope TEXT, status TEXT, value_or_hyperparams TEXT, version INT)')
    connection.execute("INSERT INTO param VALUES ('market_min_n', '{}', 'champion', '2', 1)")
    # Tokens are supplied by the shared SQL helper on Spark. Here JSON is the array transport.
    connection.create_function('title_terms', 1, lambda title: title)
    connection.create_function('array_distinct', 1, lambda terms: json.dumps(sorted(set(json.loads(terms or '[]')))))
    connection.create_function('market_min_n', 0, lambda: connection.execute(
        "SELECT CAST(value_or_hyperparams AS INT) FROM param WHERE name = 'market_min_n' AND scope = '{}' AND status = 'champion' ORDER BY version DESC LIMIT 1").fetchone()[0])
    yield connection
    connection.close()


def local_sql(query):
    query = query.replace('secondhand.market.', '').replace('secondhand.core.', '').replace('secondhand.measures.', '')
    query = query.replace('LATERAL VIEW explode(array_distinct(title_terms)) terms AS term',
                          'JOIN json_each(array_distinct(title_terms)) terms').replace('SELECT kind, term,', 'SELECT kind, terms.value AS term,', 1)
    query = query.replace('GROUP BY kind, term', 'GROUP BY kind, terms.value')
    return query


def rows(db):
    return [dict(row) for row in db.execute(local_sql(term_list.select_sql('secondhand')))]


def seed(db):
    db.executemany('INSERT INTO comp VALUES (?, ?, ?, ?, ?, ?)', [
        ('mercari_kaggle', 'clothes', 'Alpha', '["denim","denim","rare"]', 123456789, 'wrong column'),
        ('mercari_kaggle', 'clothes', 'Beta', '["denim","jacket"]', 987654321, 'wrong column'),
        ('mercari_kaggle', 'clothes', ' alpha ', '["jacket"]', 100, 'wrong column'),
        ('elsewhere', 'clothes', 'Leak', 'NOT JSON: must never reach tokenizer', 1, 'wrong column'),
    ])


def test_output_schema_and_contents_never_include_source_values(db):
    seed(db)
    result = rows(db)
    assert result
    assert set(result[0]) == {'kind', 'term', 'brand', 'n_rows', 'n_brands'}
    assert not any(re.search(r'price|amount|cents', key, re.I) for row in result for key in row)
    assert not any(str(value) in ('123456789', '987654321', 'wrong column') for row in result for value in row.values())
    ddl = (ROOT / 'databricks/sql/03_measures.sql').read_text().split('CREATE TABLE IF NOT EXISTS secondhand.measures.term_list (')[1].split(') COMMENT')[0]
    assert [line.strip().split()[0] for line in ddl.splitlines() if line.strip()] == list(term_list.COLUMNS)
    assert not re.search(r'price|amount|cents', ddl, re.I)


def test_non_mercari_rows_never_reach_tokenizer_and_minimum_is_a_param(db):
    seed(db)
    assert rows(db) == [
        {'kind': 'clothes', 'term': None, 'brand': 'alpha', 'n_rows': 2, 'n_brands': 1},
        {'kind': 'clothes', 'term': 'denim', 'brand': None, 'n_rows': 2, 'n_brands': 2},
        {'kind': 'clothes', 'term': 'jacket', 'brand': None, 'n_rows': 2, 'n_brands': 2},
    ]
    db.execute("UPDATE param SET value_or_hyperparams = '3'")
    assert rows(db) == [], 'term counts must follow the champion param, not a task literal'


def test_repeatable_counts_ignore_duplicate_terms_and_input_order(db):
    seed(db)
    expected = rows(db)
    db.execute('CREATE TABLE reversed AS SELECT * FROM comp ORDER BY rowid DESC')
    db.execute('DELETE FROM comp')
    db.execute('INSERT INTO comp SELECT * FROM reversed')
    assert rows(db) == expected == rows(db)


def test_missing_titles_and_brands_do_not_create_empty_entries(db):
    db.executemany('INSERT INTO comp VALUES (?, ?, ?, ?, ?, ?)', [
        ('mercari_kaggle', 'clothes', None, '["denim"]', 1, None),
        ('mercari_kaggle', 'clothes', ' ', '["denim"]', 2, None),
        ('mercari_kaggle', 'clothes', 'Alpha', None, 3, None),
        ('mercari_kaggle', 'clothes', 'Alpha', '[]', 4, None),
    ])
    assert rows(db) == [
        {'kind': 'clothes', 'term': None, 'brand': 'alpha', 'n_rows': 2, 'n_brands': 1},
        {'kind': 'clothes', 'term': 'denim', 'brand': None, 'n_rows': 2, 'n_brands': 0},
    ]


def test_read_and_write_are_explicit_and_use_shared_tokenizer():
    query = term_list.select_sql('demo')
    assert "FROM demo.market.comp WHERE source = 'mercari_kaggle'" in query
    assert 'demo.market.title_terms(title)' in query
    assert not re.search(r'price|amount|cents|description|SELECT\s+\*', query, re.I)
    write = term_list.write_sql('demo')
    assert write.startswith('INSERT OVERWRITE demo.measures.term_list (kind, term, brand, n_rows, n_brands)')
    with pytest.raises(ValueError, match='catalog'):
        term_list.select_sql('bad;catalog')


def test_serverless_entrypoint_accepts_root_without_file(serverless_entrypoint):
    serverless_entrypoint('databricks/tasks/term_list.py', ['--root', str(ROOT)])


def test_job_writes_counts_logs_them_and_rethrows_write_failure(db, monkeypatch, capsys):
    seed(db)
    db.execute('CREATE TABLE term_list (kind TEXT, term TEXT, brand TEXT, n_rows INT, n_brands INT)')

    class Result(dict):
        def asDict(self):
            return dict(self)

    fail = False

    def execute(statement):
        query = local_sql(statement)
        if query.startswith('INSERT OVERWRITE'):
            if fail:
                raise RuntimeError('injected term-list write failure')
            db.execute('DELETE FROM term_list')
            query = query.replace('INSERT OVERWRITE', 'INSERT INTO', 1)
        return SimpleNamespace(collect=lambda: [Result(row) for row in db.execute(query)])

    spark_module = ModuleType('pyspark.sql')
    spark_module.SparkSession = SimpleNamespace(getActiveSession=lambda: SimpleNamespace(sql=execute))
    monkeypatch.setitem(sys.modules, 'pyspark', ModuleType('pyspark'))
    monkeypatch.setitem(sys.modules, 'pyspark.sql', spark_module)
    args = ['--root', str(ROOT)]
    assert term_list.main(args) == {'rows': 3, 'terms': 2, 'brands': 1}
    assert term_list.main(args) == {'rows': 3, 'terms': 2, 'brands': 1}
    assert db.execute('SELECT count(*) FROM term_list').fetchone()[0] == 3
    events = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert any(row['event'] == 'note' and row.get('n_rows') == 3 for row in events)
    assert any(row['event'] == 'job.state' and row.get('state') == 'done' and row.get('terms') == 2 for row in events)
    assert sum(row['event'] == 'call.start' for row in events) == sum(row['event'] == 'call.end' for row in events) == 6
    fail = True
    with pytest.raises(RuntimeError, match='injected term-list write failure'):
        term_list.main(args)
    events = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert any(row['event'] == 'job.state' and row.get('state') == 'failed' for row in events)
    assert events[-1]['event'] == 'session.end' and events[-1]['ok'] is False
