import os
import sys
import json
import tempfile
import shutil
import pytest
from scripts.main import CommitValidator, GitHubAction


def make_event_file(event: dict) -> str:
    fd, path = tempfile.mkstemp(suffix='.json')
    with os.fdopen(fd, 'w') as f:
        json.dump(event, f)
    return path


def set_env(event_name, event_path, extra_env=None):
    os.environ['GITHUB_EVENT_NAME'] = event_name
    os.environ['GITHUB_EVENT_PATH'] = event_path
    if extra_env:
        for k, v in extra_env.items():
            os.environ[k] = v


def clear_env():
    for k in list(os.environ.keys()):
        if k.startswith('INPUT_') or k in ['GITHUB_EVENT_NAME', 'GITHUB_EVENT_PATH', 'GITHUB_TOKEN']:
            os.environ.pop(k)


def test_valid_commit(monkeypatch):
    clear_env()
    event = {'commits': [{'message': 'feat: add new feature', 'id': 'abc123'}]}
    event_path = make_event_file(event)
    set_env('push', event_path, {
        'INPUT_PATTERN': r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+',
        'INPUT_PATTERN_DESCRIPTION': 'Conventional Commits format',
        'INPUT_CHECK_ALL_COMMITS': 'false',
        'INPUT_CASE_SENSITIVE': 'true',
        'INPUT_FAIL_ON_ERROR': 'true',
        'INPUT_CUSTOM_ERROR_MESSAGE': ''
    })
    outputs = {}
    monkeypatch.setattr(GitHubAction, 'set_output', lambda k, v: outputs.update({k: v}))
    validator = CommitValidator()
    validator.run()
    assert outputs['valid'] == 'true'
    assert outputs['total-commits'] == 1


def test_invalid_commit(monkeypatch):
    clear_env()
    event = {'commits': [{'message': 'bad commit', 'id': 'def456'}]}
    event_path = make_event_file(event)
    set_env('push', event_path, {
        'INPUT_PATTERN': r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+',
        'INPUT_PATTERN_DESCRIPTION': 'Conventional Commits format',
        'INPUT_CHECK_ALL_COMMITS': 'false',
        'INPUT_CASE_SENSITIVE': 'true',
        'INPUT_FAIL_ON_ERROR': 'false',
        'INPUT_CUSTOM_ERROR_MESSAGE': ''
    })
    outputs = {}
    monkeypatch.setattr(GitHubAction, 'set_output', lambda k, v: outputs.update({k: v}))
    monkeypatch.setattr(GitHubAction, 'set_failed', lambda msg: None)
    validator = CommitValidator()
    validator.run()
    assert outputs['valid'] == 'false'
    assert outputs['total-commits'] == 1


def test_check_all_commits(monkeypatch):
    clear_env()
    event = {'commits': [
        {'message': 'feat: add', 'id': 'a'},
        {'message': 'fix: fix', 'id': 'b'},
        {'message': 'bad', 'id': 'c'}
    ]}
    event_path = make_event_file(event)
    set_env('push', event_path, {
        'INPUT_PATTERN': r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+',
        'INPUT_PATTERN_DESCRIPTION': 'Conventional Commits format',
        'INPUT_CHECK_ALL_COMMITS': 'true',
        'INPUT_CASE_SENSITIVE': 'true',
        'INPUT_FAIL_ON_ERROR': 'false',
        'INPUT_CUSTOM_ERROR_MESSAGE': ''
    })
    outputs = {}
    monkeypatch.setattr(GitHubAction, 'set_output', lambda k, v: outputs.update({k: v}))
    validator = CommitValidator()
    validator.run()
    assert outputs['valid'] == 'false'
    assert outputs['total-commits'] == 3


def test_case_insensitive(monkeypatch):
    clear_env()
    event = {'commits': [{'message': 'FEAT: ADD', 'id': 'abc123'}]}
    event_path = make_event_file(event)
    set_env('push', event_path, {
        'INPUT_PATTERN': r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+',
        'INPUT_PATTERN_DESCRIPTION': 'Conventional Commits format',
        'INPUT_CHECK_ALL_COMMITS': 'false',
        'INPUT_CASE_SENSITIVE': 'false',
        'INPUT_FAIL_ON_ERROR': 'true',
        'INPUT_CUSTOM_ERROR_MESSAGE': ''
    })
    outputs = {}
    monkeypatch.setattr(GitHubAction, 'set_output', lambda k, v: outputs.update({k: v}))
    validator = CommitValidator()
    validator.run()
    assert outputs['valid'] == 'true'


def test_no_commits(monkeypatch):
    clear_env()
    event = {'commits': []}
    event_path = make_event_file(event)
    set_env('push', event_path, {
        'INPUT_PATTERN': r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+',
        'INPUT_PATTERN_DESCRIPTION': 'Conventional Commits format',
        'INPUT_CHECK_ALL_COMMITS': 'false',
        'INPUT_CASE_SENSITIVE': 'true',
        'INPUT_FAIL_ON_ERROR': 'true',
        'INPUT_CUSTOM_ERROR_MESSAGE': ''
    })
    outputs = {}
    monkeypatch.setattr(GitHubAction, 'set_output', lambda k, v: outputs.update({k: v}))
    validator = CommitValidator()
    validator.run()
    assert outputs['valid'] == 'true'
    assert outputs['total-commits'] == 0


def test_fail_on_error_false(monkeypatch):
    clear_env()
    event = {'commits': [{'message': 'bad commit', 'id': 'def456'}]}
    event_path = make_event_file(event)
    set_env('push', event_path, {
        'INPUT_PATTERN': r'^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\(.+\))?: .+',
        'INPUT_PATTERN_DESCRIPTION': 'Conventional Commits format',
        'INPUT_CHECK_ALL_COMMITS': 'false',
        'INPUT_CASE_SENSITIVE': 'true',
        'INPUT_FAIL_ON_ERROR': 'false',
        'INPUT_CUSTOM_ERROR_MESSAGE': ''
    })
    outputs = {}
    monkeypatch.setattr(GitHubAction, 'set_output', lambda k, v: outputs.update({k: v}))
    monkeypatch.setattr(GitHubAction, 'set_failed', lambda msg: None)
    validator = CommitValidator()
    validator.run()
    assert outputs['valid'] == 'false'
